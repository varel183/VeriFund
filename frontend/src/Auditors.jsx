import React, { useEffect, useState } from "react";
import { useAuth } from "./auth.jsx";
import { Principal } from "@dfinity/principal";
import Alert from "./Alert.jsx";
import { backendActor } from "./backendActor.jsx";
import { getFormattedDate } from "./date.jsx";

export default function Auditors() {
  const { principal } = useAuth();
  const [stake, setStake] = useState(0);
  const [campaigns, setCampaigns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [alert, setAlert] = useState(null);

  const itemsPerPage = 3;
  const totalPages = Math.ceil(campaigns.length / itemsPerPage);
  const paginatedCampaigns = campaigns.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const loadData = async () => {
    if (!principal) return;

    setIsLoading(true);
    try {
      const [userStake, pendingCampaigns] = await Promise.all([backendActor.getMyStake(Principal.fromText(principal)), backendActor.getPendingReviewCampaigns()]);

      setStake(Number(userStake));

      const filteredCampaigns = pendingCampaigns.filter((campaign) => campaign.owner.toText() !== principal);
      setCampaigns(filteredCampaigns);
    } catch (error) {
      console.error("Error loading data:", error);
      setAlert({ type: "error", message: "Failed to load auditor data." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStake = async (e) => {
    e.preventDefault();
    setAlert(null);

    try {
      const result = await backendActor.stakeAsAuditor(Principal.fromText(principal), BigInt(500));
      if (result) {
        setAlert({
          type: "success",
          message: `Successfully staked ${500} tokens!`,
        });

        const newStake = await backendActor.getMyStake(Principal.fromText(principal));
        setStake(Number(newStake));
      }
    } catch (error) {
      console.error("Error staking:", error);
      setAlert({ type: "error", message: "Failed to stake tokens." });
    }
  };

  async function handleDownloadFile(campaignId, fileName) {
    try {
      const totalChunks = Number(await backendActor.getCampaignFileTotalChunks(campaign.id));
      const fileType = await backendActor.getCampaignFileType(campaign.id);
      let chunks = [];

      for (let i = 0; i < totalChunks; i++) {
        const chunkBlob = await backendActor.getCampaignFileChunk(campaign.id, i);
        if (chunkBlob) {
          chunks.push(chunkBlob[0]);
        } else {
          throw new Error(`Failed to retrieve chunk ${i}`);
        }
      }

      const data = new Blob(chunks, { type: fileType });
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      setAlert({
        type: "success",
        message: `File ${fileName} downloaded successfully!`,
      });
    } catch (error) {
      setAlert({
        type: "error",
        message: `Failed to download ${fileName}: ${error.message}`,
      });
    }
  }

  const handleAuditorDecision = async (campaign, approve) => {
    if (!campaign) return;

    try {
      const result = await backendActor.releaseDecision(Principal.fromText(principal), campaign.id, approve);

      if (result) {
        setAlert({
          type: "success",
          message: approve ? "Campaign approved successfully! Funds are released." : "Campaign rejected. Campaign returned to active status.",
        });

        loadData();
      } else {
        throw new Error("Decision couldn't be processed");
      }
    } catch (error) {
      console.error("Error making decision:", error);
      setAlert({ type: "error", message: "Failed to process your decision." });
    }
  };

  const changePage = (delta) => {
    setCurrentPage((prevPage) => Math.max(1, Math.min(totalPages, prevPage + delta)));
    setCurrentPage((prevPage) => Math.max(1, Math.min(totalPages, prevPage + delta)));
  };

  useEffect(() => {
    if (principal) loadData();
  }, [principal]);

  if (!principal) {
    return <div className="w-full min-h-screen flex justify-center items-center text-2xl font-bold">Please Sign In First</div>;
  }

  return (
    <div className="w-full text-gray-900 pt-6">
      <main className="container mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">Auditor Dashboard</h1>

        {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

        <section className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Your Stake</h2>

          <div className="mb-6">
            <p className="text-lg mb-2">
              Current Stake: <span className="font-semibold">{stake} tokens</span>
            </p>

            {stake === 0 && <p className="text-gray-600 italic mb-4">You need to stake tokens to become an auditor and review campaigns.</p>}

            <form onSubmit={handleStake} className="flex items-end space-x-4">
              <button type="submit" className="bg-blue-500 text-white py-2 px-6 rounded-lg hover:bg-blue-600 transition">
                Stake 500 Tokens
              </button>
            </form>
          </div>
        </section>

        {/* Campaigns section */}
        <section className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">📋 Campaigns Pending Review</h2>

          {isLoading ? (
            <p className="text-gray-500 text-center py-4">Loading campaigns...</p>
          ) : stake === 0 ? (
            <p className="text-gray-500 italic">You must stake tokens before reviewing campaigns.</p>
          ) : campaigns.length === 0 ? (
            <p className="text-gray-500 italic">No campaigns are currently pending for review.</p>
          ) : (
            <>
              <ul className="space-y-6">
                {paginatedCampaigns.map((campaign) => (
                  <li key={campaign.id} className="bg-gray-50 border-l-4 border-blue-500 p-4 rounded-lg shadow-md">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-semibold">{campaign.title}</h3>
                      <div className="text-sm font-medium text-gray-500">{getFormattedDate(campaign.date)}</div>
                    </div>

                    <p className="text-gray-600 mb-3">{campaign.description}</p>

                    <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <strong>Target Amount:</strong> {campaign.target.toString()} ICP
                      </div>
                      <div>
                        <strong>Collected:</strong> {campaign.collected.toString()} ICP
                        {Number(campaign.collected) >= Number(campaign.target) && <span className="ml-2 text-green-600 font-semibold">✓ Target reached</span>}
                      </div>
                      <div>
                        <strong>Status:</strong> {Object.keys(campaign.status)[0].replace("_", " ")}
                      </div>
                      <div>
                        <strong>Owner:</strong> <span className="font-mono text-xs">{campaign.owner.toText().substring(0, 15)}...</span>
                      </div>
                    </div>

                    {campaign.file && campaign.file.length > 0 ? (
                      <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t justify-between border-gray-200">
                        <button onClick={() => handleDownloadFile(campaign.id, campaign.file[0].name)} className="bg-slate-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-600">
                          Download Proof
                        </button>
                        <div className="ml-auto flex gap-2">
                          <button onClick={() => handleAuditorDecision(campaign, false)} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600">
                            Reject
                          </button>
                          <button onClick={() => handleAuditorDecision(campaign, true)} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600">
                            Approve
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 italic border-gray-200 border-t pt-2">Proof not yet submitted</p>
                    )}
                  </li>
                ))}
              </ul>

              {/* Pagination controls */}
              {campaigns.length > itemsPerPage && (
                <div className="flex justify-between mt-6">
                  <button onClick={() => changePage(-1)} disabled={currentPage === 1} className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50">
                    Previous
                  </button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button onClick={() => changePage(1)} disabled={currentPage === totalPages} className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50">
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
