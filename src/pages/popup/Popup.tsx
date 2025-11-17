import { FC, useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { saveApiKey, loadApiKey } from "@/state/slices/settingsSlice";
import { RootState, AppDispatch } from "@/state/store";
import { Settings, MessageSquare, ArrowLeft } from "lucide-react";

const Popup: FC = () => {
  const dispatch: AppDispatch = useDispatch();
  const [showSettings, setShowSettings] = useState(false);
  const { apiKey } = useSelector((state: RootState) => state.settings);
  const [apiKeyInput, setApiKeyInput] = useState(apiKey || "");

  useEffect(() => {
    dispatch(loadApiKey());
  }, [dispatch]);

  useEffect(() => {
    setApiKeyInput(apiKey || "");
  }, [apiKey]);

  const handleToggleChat = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "TOGGLE_CHAT" }, () => {
          if (chrome.runtime.lastError) {
            console.error(
              `Popup: Could not send TOGGLE_CHAT message: ${chrome.runtime.lastError.message}`,
            );
          }
        });
      } else {
        console.error("Popup: Could not get active tab ID");
      }
    });
  };

  const handleSaveApiKey = () => {
    dispatch(saveApiKey(apiKeyInput));
  };

  return (
    <div className="w-80 text-white p-6">
      {showSettings ? (
        <div>
          <button
            onClick={() => setShowSettings(false)}
            className="flex items-center mb-4"
          >
            <ArrowLeft className="mr-2" />
            Back
          </button>
          <h1 className="text-xl mb-4">Settings</h1>
          <div className="flex flex-col">
            <label htmlFor="apiKey" className="mb-2">
              Gemini API Key
            </label>
            <input
              id="apiKey"
              type="password"
              className="bg-gray-800 text-white rounded-lg px-4 py-2 mb-4 focus:outline-none"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
            />
            <button
              onClick={handleSaveApiKey}
              className="bg-blue-500 text-white rounded-lg px-4 py-2 hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div>
          <h1 className="text-2xl font-bold mb-6 text-center">
            Gemini LeetCode Assist
          </h1>
          <button
            onClick={handleToggleChat}
            className="w-full flex items-center justify-center bg-white/10 p-2 rounded-lg mb-3 hover:bg-white/20"
          >
            <MessageSquare className="mr-2" />
            Open Chat Window
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center justify-center bg-white/10 p-2 rounded-lg hover:bg-white/20"
          >
            <Settings className="mr-2" />
            Settings
          </button>
        </div>
      )}
    </div>
  );
};

export default Popup;
