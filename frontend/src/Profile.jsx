import React, { useEffect, useState } from "react";
import { useAuth } from "./auth.jsx";
import { Principal } from "@dfinity/principal";
import Alert from "./Alert.jsx";
import { backendActor } from "./backendActor.jsx";
import useAsync from "./useAsync.jsx";

export default function Profile() {
  const { principal } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [donations, setDonations] = useState([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    target: "",
    date: "",
  });
  const [alert, setAlert] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // used to force re-fetch

  const [currentPageCampaigns, setCurrentPageCampaigns] = useState(1);
  const [currentPageDonations, setCurrentPageDonations] = useState(1);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const minDate = tomorrow.toISOString().split("T")[0];

  const {
    data: campaignsData,
    loading: loadingCampaigns,
    error: errorCampaigns,
  } = useAsync(() => (principal ? backendActor.getCampaignsByUser(Principal.fromText(principal)) : Promise.resolve([])), [principal, refreshTrigger]);

  const {
    data: donationsData,
    loading: loadingDonations,
    error: errorDonations,
  } = useAsync(() => (principal ? backendActor.getDonationsByUser(Principal.fromText(principal)) : Promise.resolve([])), [principal, refreshTrigger]);

  useEffect(() => {
    if (campaignsData) setCampaigns(campaignsData);
  }, [campaignsData]);

  useEffect(() => {
    if (donationsData) setDonations(donationsData);
  }, [donationsData]);

  const totalPagesCampaigns = Math.ceil(campaigns.length / 2);
  const totalPagesDonations = Math.ceil(donations.length / 2);
  const paginatedCampaigns = campaigns.slice((currentPageCampaigns - 1) * 2, currentPageCampaigns * 2);
  const paginatedDonations = donations.slice((currentPageDonations - 1) * 2, currentPageDonations * 2);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const createCampaign = async (e) => {
    e.preventDefault();
    try {
      const success = await backendActor.createCampaign(
        Principal.fromText(principal),
        formData.title,
        formData.description,
        BigInt(formData.target),
        BigInt(new Date(formData.date).getTime()) * 1_000_000n
      );
      if (success) {
        setAlert({
          type: "success",
          message: "Campaign created successfully!",
        });
        setFormData({ title: "", description: "", target: "", date: "" });
        setRefreshTrigger((prev) => prev + 1); // trigger refresh
      }
    } catch (error) {
      setAlert({ type: "error", message: "Error creating campaign." });
    }
  };

  async function handleCampaignFileUpload(campaignId, event) {
    const file = event.target.files[0];
    setAlert(null);

    if (!file) {
      setAlert({ type: "error", message: "Please select a file to upload." });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = new Uint8Array(e.target.result);
      const chunkSize = 1024 * 1024;
      const totalChunks = Math.ceil(content.length / chunkSize);

      try {
        for (let i = 0; i < totalChunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, content.length);
          const chunk = content.slice(start, end);

          await backendActor.uploadCampaignFile(Principal.fromText(principal), campaignId, file.name, chunk, BigInt(i), file.type);
        }
        setAlert({
          type: "success",
          message: `File ${file.name} uploaded successfully!`,
        });
        setRefreshTrigger((prev) => prev + 1);
      } catch (error) {
        setAlert({
          type: "error",
          message: `Failed to upload ${file.name}: ${error.message}`,
        });
      }
    };

    reader.readAsArrayBuffer(file);
  }

  async function handleCampaignFileDelete(campaignId, fileName) {
    if (window.confirm(`Are you sure you want to delete the file for this campaign?`)) {
      try {
        const success = await backendActor.deleteCampaignFile(Principal.fromText(principal), campaignId, fileName);
        if (success) {
          setAlert({ type: "success", message: "File deleted successfully!" });
          setRefreshTrigger((prev) => prev + 1);
        } else {
          setAlert({ type: "error", message: "Failed to delete file" });
        }
      } catch (error) {
        setAlert({
          type: "error",
          message: `Failed to delete file: ${error.message}`,
        });
      }
    }
  }

  async function handleCollectFunds(campaignId) {
    try {
      const success = await backendActor.collectFund(campaignId, Principal.fromText(principal));
      if (success) {
        setAlert({ type: "success", message: "Funds collected successfully!" });
        setRefreshTrigger((prev) => prev + 1);
      } else {
        setAlert({ type: "error", message: "Failed to collect funds" });
      }
    } catch (error) {
      setAlert({
        type: "error",
        message: `Failed to collect fund: ${error.message}`,
      });
    }
  }

  const handlePrevPageCampaigns = () => currentPageCampaigns > 1 && setCurrentPageCampaigns(currentPageCampaigns - 1);
  const handleNextPageCampaigns = () => currentPageCampaigns < totalPagesCampaigns && setCurrentPageCampaigns(currentPageCampaigns + 1);

  const handlePrevPageDonations = () => currentPageDonations > 1 && setCurrentPageDonations(currentPageDonations - 1);
  const handleNextPageDonations = () => currentPageDonations < totalPagesDonations && setCurrentPageDonations(currentPageDonations + 1);

  if (!principal) {
    return <div className="w-full min-h-screen flex justify-center items-center text-2xl font-bold">Please Sign In First</div>;
  }

  return (
    <div className="min-h-screen text-gray-900 mt-12">
      <main className="container mx-auto px-6 py-8">
        {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Profile & Create Campaign */}
          <section className="bg-white rounded-lg shadow-lg p-4">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">Profile</h2>
            <p className="bg-gray-100 rounded-md p-3 text-gray-600 font-mono">{principal}</p>

            <h3 className="text-xl font-semibold text-gray-700 mt-6 mb-4">Create a New Campaign</h3>
            <form onSubmit={createCampaign} className="space-y-4">
              <div>
                <label className="block text-gray-600 font-medium">Title</label>
                <input type="text" name="title" value={formData.title} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm px-3 py-2" required />
              </div>
              <div>
                <label className="block text-gray-600 font-medium">Description</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm px-3 py-2" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-600 font-medium">Target (ICP)</label>
                  <input type="number" name="target" value={formData.target} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm px-3 py-2" required />
                </div>
                <div>
                  <label className="block text-gray-600 font-medium">Target Date</label>
                  <input type="date" name="date" min={minDate} value={formData.date} onChange={handleInputChange} className="w-full border-gray-300 rounded-lg shadow-sm px-3 py-2" required />
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600">
                🚀 Create Campaign
              </button>
            </form>
          </section>

          {/* Campaigns & Donations */}
          <section className="space-y-8">
            <section className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">My Campaigns</h2>
              {loadingCampaigns && <p>Loading campaigns...</p>}
              {errorCampaigns && <p className="text-red-500">{errorCampaigns}</p>}
              {campaigns.length === 0 ? (
                <p className="text-gray-500">No campaigns available.</p>
              ) : (
                <>
                  <ul>
                    {paginatedCampaigns.map((camp, index) => (
                      <li key={index} className="bg-gray-50 border-l-4 border-blue-500 p-4 rounded-lg shadow-md mb-4">
                        <p className="text-lg font-semibold">{camp.title}</p>
                        <p className="text-gray-600">{camp.description}</p>
                        <p className="text-sm text-gray-500">
                          <strong>Collected:</strong> {camp.collected.toString()} / {camp.target.toString()} ICP
                        </p>
                        <p className="text-sm text-gray-500">
                          <strong>Date:</strong> {new Date(Number(camp.date) / 1_000_000).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-500">
                          <strong>Status:</strong> {Object.keys(camp.status)[0]}
                        </p>
                        <p className="text-sm text-gray-500">
                          <strong>Owner:</strong> {camp.owner.toText()}
                        </p>
                        <p className="text-sm text-gray-500">
                          <strong>Proof:</strong> {camp.file?.[0]?.name ? camp.file[0].name : "no proof"}
                        </p>
                        {Object.keys(camp.status)[0] != "collected" && (
                          <>
                            {Object.keys(camp.status)[0] != "released" ? (
                              <div className="mt-4 flex w-full items-center justify-between space-x-4">
                                <input
                                  type="file"
                                  onChange={(e) => handleCampaignFileUpload(camp.id, e)}
                                  className="text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                                />
                                {camp.file && (
                                  <button onClick={() => handleCampaignFileDelete(camp.id, camp.file[0].name)} className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-600">
                                    Delete File
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button onClick={() => handleCollectFunds(camp.id)} className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-600 mt-4">
                                Collect
                              </button>
                            )}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  {campaigns.length > 2 && (
                    <div className="flex justify-between mt-4">
                      <button onClick={handlePrevPageCampaigns} disabled={currentPageCampaigns === 1} className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50">
                        Prev
                      </button>
                      <span>
                        Page {currentPageCampaigns} of {totalPagesCampaigns}
                      </span>
                      <button
                        onClick={handleNextPageCampaigns}
                        disabled={currentPageCampaigns === totalPagesCampaigns}
                        className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">My Donations</h2>
              {loadingDonations && <p>Loading donations...</p>}
              {errorDonations && <p className="text-red-500">{errorDonations}</p>}
              {donations.length === 0 ? (
                <p className="text-gray-500">No donations found for your account.</p>
              ) : (
                <>
                  <ul>
                    {paginatedDonations.map((don, index) => (
                      <li key={index} className="bg-gray-50 border-l-4 border-green-500 p-4 rounded-lg shadow-md mb-4">
                        <p className="text-sm text-gray-600">
                          <strong>Amount:</strong> {don.amount.toString()} ICP
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>Timestamp:</strong> {new Date(Number(don.timestamp) / 1_000_000).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                  {donations.length > 2 && (
                    <div className="flex justify-between mt-4">
                      <button onClick={handlePrevPageDonations} disabled={currentPageDonations === 1} className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50">
                        Prev
                      </button>
                      <span>
                        Page {currentPageDonations} of {totalPagesDonations}
                      </span>
                      <button
                        onClick={handleNextPageDonations}
                        disabled={currentPageDonations === totalPagesDonations}
                        className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </section>
        </div>
      </main>
    </div>
  );
}
