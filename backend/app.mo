import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Bool "mo:base/Bool";
import CertifiedData "mo:base/CertifiedData";
import Cycles "mo:base/ExperimentalCycles";
import Debug "mo:base/Debug";
import HashMapBase "mo:base/HashMap";
import Option "mo:base/Option";
import Int "mo:base/Int";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Timer "mo:base/Timer";
import IC "ic:aaaaa-aa"; 
import HashMapMap "mo:map/Map";

actor class VeriFund() = this {
  type FileChunk = {
    chunk : Blob;
    index : Nat;
  };

  type File = {
    name : Text;
    chunks : [FileChunk];
    totalSize : Nat;
    fileType : Text;
  };

  type UserFiles = HashMapMap.Map<Text, File>;

  type CampaignStatus = { #active; #pending_release; #released; #collected };

  type Campaign = {
    id: Text;
    title: Text;
    owner: Principal;
    description: Text;
    target: Nat;
    collected: Nat;
    status: CampaignStatus;
    date: Time.Time;
    file: ?File; 
  };

  type Donation = {
    donor: Principal;
    amount: Nat;
    timestamp: Time.Time;
  };

  // STABLE MEMORY STORAGE
  stable var campaignsStore : [(Text, Campaign)] = [];
  stable var donationsStore : [(Text, [Donation])] = [];
  stable var stakesStore : [(Principal, Nat)] = [];
  stable var auditorsStore : [(Text, Principal)] = [];
  stable var certifiedState : Blob = Blob.fromArray([]);

  // WORKING HASHMAPBases
  var campaigns : HashMapBase.HashMap<Text, Campaign> = HashMapBase.fromIter<Text, Campaign>(campaignsStore.vals(), 0, Text.equal, Text.hash);
  var donations : HashMapBase.HashMap<Text, [Donation]> = HashMapBase.fromIter<Text, [Donation]>(donationsStore.vals(), 0, Text.equal, Text.hash);
  var stakes : HashMapBase.HashMap<Principal, Nat> = HashMapBase.fromIter<Principal, Nat>(stakesStore.vals(), 0, Principal.equal, Principal.hash);
  var auditors : HashMapBase.HashMap<Text, Principal> = HashMapBase.fromIter<Text, Principal>(auditorsStore.vals(), 0, Text.equal, Text.hash);
  
  // Per-user reminder storage
  var reminderFlags : HashMapBase.HashMap<Principal, [Text]> = HashMapBase.HashMap<Principal, [Text]>(0, Principal.equal, Principal.hash);

  // Serialize before upgrade (to stable memory)
  system func preupgrade() {
    campaignsStore := Iter.toArray(campaigns.entries());
    donationsStore := Iter.toArray(donations.entries());
    stakesStore := Iter.toArray(stakes.entries());
    auditorsStore := Iter.toArray(auditors.entries());
  };

  // Restore after upgrade (to working hashmapBases) + start reminder timer
  system func postupgrade() {
    campaigns := HashMapBase.fromIter(campaignsStore.vals(), 0, Text.equal, Text.hash);
    donations := HashMapBase.fromIter(donationsStore.vals(), 0, Text.equal, Text.hash);
    stakes := HashMapBase.fromIter(stakesStore.vals(), 0, Principal.equal, Principal.hash);
    auditors := HashMapBase.fromIter(auditorsStore.vals(), 0, Text.equal, Text.hash);

    let nowSec : Nat = Int.abs(Time.now() / 1_000_000_000);
    let daily : Nat = 86400;

    // Start recurring reminder timer every 24h
    ignore Timer.setTimer<system>(
      #seconds (daily - (nowSec % daily)),
      func () : async () {
        ignore Timer.recurringTimer<system>(#seconds daily, remind);
        await remind();
      }
    );
  };

  // Certified data: returns a blob that represents certified state
  private func updateCertifiedData() {
    let summary = "Campaigns: " # Nat.toText(campaigns.size()) #
              ", Donations: " # Nat.toText(donations.size());
    certifiedState := Text.encodeUtf8(summary);
    CertifiedData.set(certifiedState);
  };

  // Used by frontend to verify certified summary of the current state
  public query func getCertifiedData(): async Blob {
    certifiedState
  };

  stable var campaignCounter: Nat = 0; 
  
  public func createCampaign(owner: Principal, title: Text, description: Text, target: Nat, date:Time.Time): async Bool {
    let id = "campaign_" # Nat.toText(campaignCounter);
    campaignCounter += 1;

    if (Option.isSome(campaigns.get(id))) return false;
    campaigns.put(id, {
      id; title; description; owner; target; collected = 0; status = #active; date; file = null;
    });
    updateCertifiedData();
    return true;
  };

public func uploadCampaignFile(owner: Principal, id: Text, name: Text, chunk: Blob, index: Nat, fileType: Text) : async Bool {
  switch (campaigns.get(id)) {
    case (?camp) {
      if (camp.owner != owner) return false;

      let fileChunk = { chunk = chunk; index = index };
      let updatedFile = {
        name;
        chunks = if (index == 0) [fileChunk] else Array.append(
          Option.get(camp.file, { name = ""; chunks = []; totalSize = 0; fileType = "" }).chunks, 
          [fileChunk]
        );
        totalSize = if (index == 0) chunk.size() else (
          Option.get(camp.file, { name = ""; chunks = []; totalSize = 0; fileType = "" }).totalSize + chunk.size()
        );
        fileType;
      };

      campaigns.put(id, { camp with file = ?updatedFile });
      return true;
    };
    case null return false;
  };
};

  public  func deleteCampaignFile(owner: Principal, id: Text, name: Text) : async Bool {
    switch (campaigns.get(id)) {
      case (?camp) {
        if (camp.owner != owner) return false;
        
        switch (camp.file) {
          case (?file) {
            if (file.name == name) {
              campaigns.put(id, { camp with file = null });
              return true;
            };
            return false;
          };
          case null return false;
        };
      };
      case null return false;
    };
  };

  public query func getCampaignFileTotalChunks(id: Text) : async Nat {
    switch (campaigns.get(id)) {
      case (?camp) {
        switch (camp.file) {
          case (?file) file.chunks.size();
          case null 0;
        };
      };
      case null 0;
    };
  };

  public query func getCampaignFileChunk(id: Text, index: Nat) : async ?Blob {
    switch (campaigns.get(id)) {
      case (?camp) {
        switch (camp.file) {
          case (?file) {
            let chunk = Array.find(file.chunks, func(chunk : FileChunk) : Bool { 
              chunk.index == index 
            });
            switch (chunk) {
              case (?foundChunk) ?foundChunk.chunk;
              case null null;
            };
          };
          case null null;
        };
      };
      case null null;
    };
  };

  public query func getCampaignFileType(id: Text) : async ?Text {
    switch (campaigns.get(id)) {
      case (?camp) {
        switch (camp.file) {
          case (?file) ?file.fileType;
          case null null;
        };
      };
      case null null;
    };
  };

  // Donate ICP (mocked) to a specific campaign
  public func donate(donor:Principal, id: Text, amount: Nat): async Bool {
  switch (campaigns.get(id)) {
    case null return false;
    case (?camp) {
      if (camp.status == #released or camp.status == #collected) return false;
      
      let newCollected = camp.collected + amount;
      
      let newStatus = if (newCollected >= camp.target) #pending_release else camp.status;
      
      campaigns.put(id, { 
        camp with 
        collected = newCollected;
        status = newStatus;
      });

      let donation: Donation = {
        donor;
        amount;
        timestamp = Time.now();
      };

      let updated = switch (donations.get(id)) {
        case null { [donation] };
        case (?list) { Array.append(list, [donation]) };
      };
      donations.put(id, updated);
      updateCertifiedData();
      
      return true;
    };
  };
};

  public func stakeAsAuditor(who: Principal,amount: Nat): async Bool {
    let prev = Option.get(stakes.get(who), 0);
    stakes.put(who, prev + amount);
    return true;
  };

  public func releaseDecision(who: Principal, id: Text, approve: Bool): async Bool {
    switch (auditors.get(id)) {
      case (?aud) if (aud != who) return false;
      case _ {};
    };
    switch (campaigns.get(id)) {
      case (?camp) {
        if (camp.status != #pending_release) return false;
        let newStatus = if (approve) #released else #active;
        campaigns.put(id, { camp with status = newStatus });
        updateCertifiedData();
        return true;
      };
      case null return false;
    };
  };

  // Reminder logic run daily — updates reminderFlags per fundraiser
  private func remind() : async () {
    reminderFlags := HashMapBase.HashMap<Principal, [Text]>(0, Principal.equal, Principal.hash);
    for ((id, camp) in campaigns.entries()) {
      if (camp.status == #pending_release) {
        let existing = Option.get(reminderFlags.get(camp.owner), []);
        reminderFlags.put(camp.owner, Array.append(existing, [id]));
        Debug.print("Reminder flagged for: " # Principal.toText(camp.owner));
      };
    };
  };

  // This transform function is required for HTTPS outcalls to strip headers.
  public query func transform({
    response : IC.http_request_result;
  }) : async IC.http_request_result {
    {
      response with headers = [];
    };
  };

  public func getICPUSD() : async Text {
    let host : Text = "api.coingecko.com";
    let url = "https://" # host # "/api/v3/simple/price?ids=internet-computer&vs_currencies=usd";

    let request_headers = [
      { name = "User-Agent"; value = "verifund-canister" },
      { name = "Accept"; value = "application/json" }
    ];

    let http_request : IC.http_request_args = {
      url = url;
      max_response_bytes = ?2000;
      headers = request_headers;
      body = null;
      method = #get;
      transform = ?{
        function = transform;
        context = Blob.fromArray([]);
      };
    };

    Cycles.add<system>(230_949_972_000);  // Sufficient cycles for HTTPS outcall
    let http_response : IC.http_request_result = await IC.http_request(http_request);

    let body_text = switch (Text.decodeUtf8(http_response.body)) {
      case null { "No value returned" };
      case (?body) { body };
    };

    return body_text;
  };

  // Returns campaigns that the specified user must submit proof for (used in frontend)
  public query func getMyPendingCampaigns(who: Principal) : async [Text] {
    let filtered = Iter.filter<(Text, Campaign)>(
      campaigns.entries(),
      func((id: Text, camp: Campaign)) : Bool {
        camp.owner == who and camp.status == #pending_release
      }
    );

    let mapped = Iter.map<(Text, Campaign), Text>(
      filtered,
      func((id: Text, _)) : Text { id }
    );

    Iter.toArray<Text>(mapped);
  };

  public func requestFundRelease(who: Principal, id: Text): async Bool {
  switch (campaigns.get(id)) {
    case (?camp) {
      if (camp.owner != who or camp.status != #active) return false;
      campaigns.put(id, { camp with status = #pending_release });
      updateCertifiedData();
      return true;
    };
    case null return false;
  };
};

public query func getPendingReviewCampaigns(): async [Campaign] {
  let filtered = Iter.filter<(Text, Campaign)>(
    campaigns.entries(),
    func((id: Text, camp: Campaign)) : Bool {
      camp.status == #pending_release
    }
  );

  let mapped = Iter.map<(Text, Campaign), Campaign>(
    filtered,
    func((id: Text, camp: Campaign)) : Campaign { camp }
  );

  Iter.toArray<Campaign>(mapped);
};

// Check if user can be an auditor for a specific campaign
public query func canReviewCampaign(reviewer: Principal, campaignId: Text): async Bool {
  switch (campaigns.get(campaignId)) {
    case (?campaign) {
      // User cannot review their own campaign
      if (campaign.owner == reviewer) {
        return false;
      };
      // User must have staked something
      let userStake = Option.get(stakes.get(reviewer), 0);
      return userStake > 0;
    };
    case null {
      return false;
    };
  };
};

  // Queries
  public query func getCampaigns(): async [Campaign] {
    Iter.toArray(campaigns.vals());
  };

  public query func getCampaignsByUser(user: Principal): async [Campaign] {
    let filtered = Iter.filter<(Text, Campaign)>(
      campaigns.entries(),
      func((id: Text, camp: Campaign)) : Bool {
        camp.owner == user
      }
    );

    let mapped = Iter.map<(Text, Campaign), Campaign>(
      filtered,
      func((id: Text, camp: Campaign)) : Campaign {
        camp
      }
    );

    Iter.toArray(mapped);
  };

  public query func getDonationsByID(id: Text): async [Donation] {
    Option.get(donations.get(id), []);
  };

  public query func getDonationsByUser(user: Principal): async [Donation] {
    let allDonations : [Donation] = Array.flatten(Iter.toArray(donations.vals()));

    Array.filter<Donation>(allDonations, func(d: Donation) : Bool {
      d.donor == user
    });
  };

  public query func getMyStake(who: Principal): async Nat {
    Option.get(stakes.get(who), 0);
  };

  public query (message) func whoami() : async Principal {
    message.caller;
  };

  public func getReleasedCampaigns(user: Principal) : async [Text] {
    var releasedCampaigns: [Text] = [];

    for ((id, campaign) in campaigns.entries()) {
        if (campaign.owner == user and campaign.status == #released) {
            releasedCampaigns := Array.append(releasedCampaigns,[campaign.title]);
        };
    };

    return releasedCampaigns;
  };

  public func collectFund(campaignId: Text, user: Principal) : async Bool {
      switch (campaigns.get(campaignId)) {
          case (?c) {
              if (c.owner == user and c.status == #released) {
                  campaigns.put(campaignId, { c with status = #collected });
                  return true;
              } else {
                  return false;
              }
          };
          case null { return false };
      }
  }
};
