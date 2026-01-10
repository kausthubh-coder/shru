"use client";

import { useState } from "react";
import type { PlaygroundConfig, PlaygroundArchitecture, PlannerConfig } from "../agents/types";
import { PLAYGROUND_MODELS } from "../lib/openrouter";
import { VOICE_OPTIONS } from "../agents/voice/config";

interface PlaygroundControlsProps {
  config: PlaygroundConfig;
  onConfigChange: (updates: Partial<PlaygroundConfig>) => void;
  onPlannerConfigChange: (updates: Partial<PlannerConfig>) => void;
  isConnected: boolean;
  // Audio Config Props
  inputDevices: MediaDeviceInfo[];
  outputDevices: MediaDeviceInfo[];
  selectedInputId: string;
  setSelectedInputId: (id: string) => void;
  selectedOutputId: string;
  setSelectedOutputId: (id: string) => void;
  playTestTone: () => void;
  pushToTalk: boolean;
  setPushToTalk: (v: boolean) => void;
}

export function PlaygroundControls({
  config,
  onConfigChange,
  onPlannerConfigChange,
  isConnected,
  inputDevices,
  outputDevices,
  selectedInputId,
  setSelectedInputId,
  selectedOutputId,
  setSelectedOutputId,
  playTestTone,
  pushToTalk,
  setPushToTalk,
}: PlaygroundControlsProps) {
  const [activeTab, setActiveTab] = useState<"general" | "voice" | "planner" | "debug">("general");

  const TabButton = ({ id, label }: { id: typeof activeTab, label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
        activeTab === id
          ? "border-blue-500 text-blue-600 dark:text-blue-400"
          : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800">
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Playground Settings</h2>
      </div>

      <div className="flex border-b border-neutral-200 dark:border-neutral-800 px-2 overflow-x-auto">
        <TabButton id="general" label="General" />
        <TabButton id="voice" label="Voice" />
        <TabButton id="planner" label="Planner" />
        <TabButton id="debug" label="Debug" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeTab === "general" && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Architecture</label>
              <select
                value={config.architecture}
                onChange={(e) => onConfigChange({ architecture: e.target.value as PlaygroundArchitecture })}
                disabled={isConnected}
                className="w-full text-xs p-2 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="realtime_tools">Realtime (Voice + Tools)</option>
                <option value="split_planner">Split Planner (Voice + LLM)</option>
                <option value="specialists">Specialists (Experimental)</option>
              </select>
              <p className="text-[10px] text-neutral-500 mt-1">
                {config.architecture === "realtime_tools" && "Fastest. Voice agent calls tools directly."}
                {config.architecture === "split_planner" && "Smarter. Voice agent delegates tasks to a reasoning LLM."}
                {config.architecture === "specialists" && "Complex tasks. Specialized agents for each domain."}
              </p>
            </div>
          </div>
        )}

        {activeTab === "voice" && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Voice Persona</label>
              <select
                value={config.voice.voice}
                onChange={(e) => onConfigChange({ voice: { ...config.voice, voice: e.target.value } })}
                className="w-full text-xs p-2 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {VOICE_OPTIONS.map((voice) => (
                  <option key={voice.id} value={voice.id}>{voice.name} - {voice.description}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">VAD Sensitivity</label>
              <select
                value={config.voice.vadEagerness}
                onChange={(e) => onConfigChange({ voice: { ...config.voice, vadEagerness: e.target.value as any } })}
                className="w-full text-xs p-2 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="low">Low (Relaxed)</option>
                <option value="medium">Medium (Balanced)</option>
                <option value="high">High (Interruptive)</option>
              </select>
            </div>

            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700">
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Microphone</label>
              <select
                value={selectedInputId}
                onChange={(e) => setSelectedInputId(e.target.value)}
                className="w-full text-xs p-2 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Default Input</option>
                {inputDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,4)}`}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Speaker</label>
              <select
                value={selectedOutputId}
                onChange={(e) => setSelectedOutputId(e.target.value)}
                className="w-full text-xs p-2 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Default Output</option>
                {outputDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0,4)}`}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-neutral-700 dark:text-neutral-300">Push to Talk</span>
              <button 
                onClick={() => setPushToTalk(!pushToTalk)}
                className={`w-8 h-4 rounded-full transition-colors relative ${pushToTalk ? 'bg-blue-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${pushToTalk ? 'translate-x-4' : ''}`} />
              </button>
            </div>

            <button 
              onClick={playTestTone}
              className="w-full py-1.5 text-xs rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              Test Audio Output
            </button>
          </div>
        )}

        {activeTab === "planner" && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Planner Model</label>
              <select
                value={config.planner.model}
                onChange={(e) => onPlannerConfigChange({ model: e.target.value })}
                className="w-full text-xs p-2 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {PLAYGROUND_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Temperature: {config.planner.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config.planner.temperature}
                onChange={(e) => onPlannerConfigChange({ temperature: parseFloat(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Max Steps: {config.planner.maxSteps}
              </label>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={config.planner.maxSteps}
                onChange={(e) => onPlannerConfigChange({ maxSteps: parseInt(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">System Prompt Override</label>
              <textarea
                value={config.planner.systemPrompt}
                onChange={(e) => onPlannerConfigChange({ systemPrompt: e.target.value })}
                placeholder="Default context-aware prompt..."
                className="w-full h-32 text-xs p-2 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
            </div>
          </div>
        )}

        {activeTab === "debug" && (
          <div className="space-y-4">
            <div className="space-y-2">
              {[
                { id: 'showLogs', label: 'Show Event Logs' },
                { id: 'showContext', label: 'Show Context Panel' },
                { id: 'showToolCalls', label: 'Show Tool Calls' },
              ].map((toggle) => (
                <div key={toggle.id} className="flex items-center justify-between">
                  <span className="text-xs text-neutral-700 dark:text-neutral-300">{toggle.label}</span>
                  <button 
                    onClick={() => onConfigChange({ debug: { ...config.debug, [toggle.id]: !config.debug[toggle.id as keyof typeof config.debug] } })}
                    className={`w-8 h-4 rounded-full transition-colors relative ${config.debug[toggle.id as keyof typeof config.debug] ? 'bg-blue-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${config.debug[toggle.id as keyof typeof config.debug] ? 'translate-x-4' : ''}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
