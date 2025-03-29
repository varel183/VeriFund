import React, { useState, useEffect } from "react";
import Alert from "./Alert.jsx";
import { backendActor } from "./backendActor.jsx";
import { getFormattedDate } from "./date.jsx";
import { useAuth } from "./auth.jsx";
import { Principal } from "@dfinity/principal";
import useAsync from "./useAsync.jsx";

export default function CampaignDetails({ id }) {
  const { principal, login } = useAuth();
  const [campaign, setCampaign] = useState(null);
  const [donations, setDonations] = useState([]);
  const [alert, setAlert] = useState(null);
  const [donationAmount, setDonationAmount] = useState("");

  // Pagination for donations
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Fetch ICP to USD conversion rate
  const { data: usdData, loading: loadingUSD, error: errorUSD } = useAsync(() => backendActor.getICPUSD(), [backendActor]);

  const loadCampaignDetails = async () => {
    try {
      const campaigns = await backendActor.getCampaigns();
      const campaign = campaigns.find((camp) => camp.id === id);
      setCampaign(campaign);

      const donationsData = await backendActor.getDonationsByID(id);
      setDonations(donationsData);
    } catch (error) {
      console.error("Error loading campaign details:", error);
      setAlert({ type: "error", message: "Error loading campaign details." });
    }
  };

  useEffect(() => {
    loadCampaignDetails();
  }, [id]);

  const donateToCampaign = async () => {
    if (!principal) {
      setAlert({
        type: "error",
        message: "Please sign in to donate.",
      });
      return;
    }

    if (!donationAmount || isNaN(donationAmount) || donationAmount <= 0) {
      setAlert({
        type: "error",
        message: "Please enter a valid donation amount.",
      });
      return;
    }

    try {
      const result = await backendActor.donate(Principal.fromText(principal), id, BigInt(donationAmount));
      if (result) {
        setAlert({ type: "success", message: "Donation successful!" });
        setDonationAmount("");
        loadCampaignDetails(); // Refresh campaign data
      } else {
        setAlert({ type: "error", message: "Donation failed." });
      }
    } catch (error) {
      setAlert({ type: "error", message: `Error during donation: ${error.message}` });
    }
  };

  // Calculate total pages and paginated donations
  const totalPages = Math.ceil(donations.length / itemsPerPage);
  const paginatedDonations = donations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!campaign) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <p className="text-gray-500 text-xl">Loading campaign details...</p>
      </div>
    );
  }

  // Calculate USD value if data is available
  const icpUsdRate = !loadingUSD && !errorUSD && usdData ? JSON.parse(usdData)?.["internet-computer"]?.usd : null;
  const collectedUSD = icpUsdRate ? (Number(campaign.collected) * icpUsdRate).toFixed(2) : null;
  const targetUSD = icpUsdRate ? (Number(campaign.target) * icpUsdRate).toFixed(2) : null;

  return (
    <div className="text-gray-900 w-full px-6 py-8 mt-12">
      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
        <div>
          <img src="/donation.jpg" alt={campaign.title} className="w-full h-64 object-cover rounded-lg mb-4" />
        </div>
        <h1 className="text-3xl font-bold mb-4">{campaign.title}</h1>
        <p className="text-gray-700 mb-6">{campaign.description}</p>
        <div className="mb-6 space-y-2">
          <div className="flex flex-col md:flex-row justify-between items-start">
            <p className="text-lg">
              <strong>Target:</strong> {campaign.target.toString()} ICP
              {targetUSD && <span className="text-blue-600 ml-2">≈ ${targetUSD} USD</span>}
            </p>
            <p className="text-lg">
              <strong>Collected:</strong> {campaign.collected.toString()} ICP
              {collectedUSD && <span className="text-blue-600 ml-2">≈ ${collectedUSD} USD</span>}
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mt-2 mb-3">
            <div
              className="h-3 rounded-full bg-green-500"
              style={{
                width: `${Math.min((Number(campaign.collected) / Number(campaign.target)) * 100, 100)}%`,
              }}
            ></div>
          </div>
          <p className="text-lg">
            <strong>Status:</strong> {Object.keys(campaign.status)[0]}
          </p>
          <p className="text-lg">
            <strong>Date:</strong> {getFormattedDate(campaign.date)}
          </p>
        </div>

        {/* Donation Form */}
        <div className="border-t pt-6">
          <h3 className="text-xl font-bold mb-4">Support this campaign</h3>
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="number"
              min="1"
              placeholder="Enter amount (ICP)"
              value={donationAmount}
              onChange={(e) => setDonationAmount(e.target.value)}
              className="flex-grow px-4 py-2 border rounded-lg"
            />
            <button onClick={principal ? donateToCampaign : login} className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg transition-colors">
              {principal ? "Donate" : "Sign in to donate"}
            </button>
          </div>
          {icpUsdRate && donationAmount && !isNaN(donationAmount) && donationAmount > 0 && <p className="mt-2 text-sm text-blue-600">≈ ${(Number(donationAmount) * icpUsdRate).toFixed(2)} USD</p>}
        </div>
      </div>

      <section className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-4">Donations</h2>
        {donations.length === 0 ? (
          <p className="text-gray-500">No donations yet.</p>
        ) : (
          <>
            <ul className="space-y-4">
              {paginatedDonations.map((donation, index) => (
                <li key={index} className="bg-gray-50 border-l-4 border-green-500 p-4 rounded shadow">
                  <p className="text-sm text-gray-700">
                    <strong>Donor:</strong> {donation.donor.toText()}
                  </p>
                  <div className="flex items-center">
                    <p className="text-sm text-gray-700">
                      <strong>Amount:</strong> {donation.amount.toString()} ICP
                    </p>
                    {icpUsdRate && <span className="ml-2 text-xs text-blue-600">≈ ${(Number(donation.amount) * icpUsdRate).toFixed(2)} USD</span>}
                  </div>
                  <p className="text-sm text-gray-700">
                    <strong>Timestamp:</strong> {getFormattedDate(donation.timestamp)}
                  </p>
                </li>
              ))}
            </ul>

            {/* Pagination Controls */}
            {donations.length > itemsPerPage && (
              <div className="flex items-center justify-center mt-6 space-x-4">
                <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50">
                  Prev
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
