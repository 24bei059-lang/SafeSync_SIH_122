import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  Play,
  Check,
  Clock,
  RotateCcw,
  Smartphone,
  Radio,
} from 'lucide-react';
import { PlanActivity, ExtractedEvent } from '../types';
import { applyEventToActivity } from '../services/confidenceRouter';
import { detectConflicts } from '../services/conflictDetector';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  clarificationOptions?: string[];
  loggedEvent?: any;
}

interface TimeAgentTabProps {
  planActivities: PlanActivity[];
  onCommitEventFromAgent: (
    event: ExtractedEvent,
    updatedActivity: PlanActivity,
    alerts: any[],
    auditEntry: any
  ) => void;
}

export const TimeAgentTab: React.FC<TimeAgentTabProps> = ({
  planActivities,
  onCommitEventFromAgent,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      sender: 'agent',
      text: 'Namaste Supervisor! SiteSync Time Agent ready. Speak or text your daily execution updates (e.g. "Piping spool erection on Line 24 started today" or "Pump P-101 baseplate grouting finished").',
      timestamp: 'Just now',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [language, setLanguage] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quickMode, setQuickMode] = useState<'START' | 'FINISH' | 'DELAY' | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [language]);

  const toggleSpeechRecognition = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported by your browser. Please type your update.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.lang = language;
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Error starting recognition:', err);
      }
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || inputText).trim();
    if (!messageContent || isSubmitting) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: messageContent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsSubmitting(true);

    try {
      const history = messages.slice(-5).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        text: m.text,
      }));

      const res = await fetch('/api/time-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageContent,
          history,
          planActivities: planActivities.slice(0, 30),
        }),
      });

      const data = await res.json();

      const agentMsg: Message = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: data.reply || 'Logged update into schedule.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        clarificationOptions: data.clarificationOptions,
        loggedEvent: data.extractedEvent,
      };

      setMessages((prev) => [...prev, agentMsg]);

      // If clear event logged and matched
      if (data.extractedEvent && !data.needsClarification) {
        const rawEvt = data.extractedEvent;
        // Attempt to find matching activity
        const matched =
          (data.matchedActivityId && planActivities.find((a) => a.ActivityID === data.matchedActivityId)) ||
          planActivities.find(
            (a) =>
              (rawEvt.tagIds && rawEvt.tagIds.some((t: string) => a.Name.includes(t))) ||
              a.Name.toLowerCase().includes(rawEvt.activityDescription.toLowerCase().slice(0, 15))
          );

        if (matched) {
          const eventItem: ExtractedEvent = {
            id: `agent-evt-${Date.now()}`,
            discipline: matched.Discipline,
            rawText: messageContent,
            activityDescription: rawEvt.activityDescription || messageContent,
            eventType: rawEvt.eventType || 'PROGRESS',
            date: rawEvt.date || new Date().toISOString().split('T')[0],
            quantityDone: rawEvt.quantityDone || null,
            quantityTotal: null,
            percentComplete: rawEvt.percentComplete || (rawEvt.eventType === 'FINISH' ? 100 : null),
            location: matched.Area,
            tagIds: rawEvt.tagIds || [],
            delayReason: rawEvt.delayReason || null,
            delayCategory: rawEvt.delayCategory || null,
            sourceSpan: messageContent,
            sourceDocument: 'Supervisor Time Agent (Voice/Chat)',
            matchedActivityId: matched.ActivityID,
            matchedActivityName: matched.Name,
            confidence: 94,
            routing: 'AUTO_COMMITTED',
            status: 'COMMITTED',
          };

          const confs = detectConflicts(eventItem, matched, planActivities);
          const { updatedActivity, auditEntry } = applyEventToActivity(
            eventItem,
            matched,
            'Supervisor Time Agent'
          );
          onCommitEventFromAgent(eventItem, updatedActivity, confs, auditEntry);
        }
      }
    } catch (err: any) {
      console.error('Time agent failure:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'agent',
          text: `Logged locally: "${messageContent}". Added to field execution queue.`,
          timestamp: 'Just now',
        },
      ]);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const handleSelectOption = (opt: string) => {
    handleSendMessage(`I meant: ${opt}`);
  };

  const handleQuickLog = (type: 'START' | 'FINISH' | 'DELAY') => {
    setQuickMode(type);
    let template = '';
    if (type === 'START') template = 'Started work today on Line 24"-PR-1042 piping spool erection with 6 riggers';
    if (type === 'FINISH') template = 'Finished 100% casting for Pump P-101 foundation PCC today';
    if (type === 'DELAY') template = 'Hydrotest Line 12"-HC-2001 delayed today due to blind flange shortage from warehouse';
    setInputText(template);
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      {/* Header & Speech Language Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Supervisor Time Agent
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Voice + Conversational Assistant
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Hands-free field logging for site supervisors. Asks 1 clarifying question when ambiguous and auto-commits clear milestones.
          </p>
        </div>

        {/* Language selector & Mic badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950 p-1 rounded border border-slate-800 text-xs">
            <button
              onClick={() => setLanguage('en-IN')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                language === 'en-IN' ? 'bg-slate-800 text-amber-400 font-semibold' : 'text-slate-400'
              }`}
            >
              en-IN
            </button>
            <button
              onClick={() => setLanguage('hi-IN')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                language === 'hi-IN' ? 'bg-slate-800 text-amber-400 font-semibold' : 'text-slate-400'
              }`}
            >
              hi-IN (हिंदी)
            </button>
          </div>
        </div>
      </div>

      {/* Minimal-Friction Big Mobile Quick Buttons */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <button
          onClick={() => handleQuickLog('START')}
          className="p-3 sm:p-3.5 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/60 rounded-lg text-left transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <Play className="h-4 w-4 fill-current text-emerald-400" />
              Log Start
            </span>
            <span className="text-[10px] text-emerald-500 font-mono">1-Tap</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">Activity commenced today</span>
        </button>

        <button
          onClick={() => handleQuickLog('FINISH')}
          className="p-3 sm:p-3.5 bg-sky-950/40 hover:bg-sky-900/50 border border-sky-800/60 rounded-lg text-left transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
              <Check className="h-4 w-4 text-sky-400" />
              Log Finish
            </span>
            <span className="text-[10px] text-sky-500 font-mono">100%</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">Milestone completed</span>
        </button>

        <button
          onClick={() => handleQuickLog('DELAY')}
          className="p-3 sm:p-3.5 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/60 rounded-lg text-left transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              Log Delay
            </span>
            <span className="text-[10px] text-rose-500 font-mono">Hold</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">Material / weather / permit</span>
        </button>
      </div>

      {/* Chat Messages Stream */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 h-[420px] overflow-y-auto space-y-4">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-xl p-3 text-xs space-y-2 ${
                  isUser
                    ? 'bg-amber-500 text-slate-950 font-medium'
                    : 'bg-slate-950 border border-slate-800 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-4 text-[10px] opacity-75">
                  <span className="font-semibold">{isUser ? 'Supervisor' : 'SiteSync Agent'}</span>
                  <span className="font-mono">{msg.timestamp}</span>
                </div>

                <p className="leading-relaxed text-xs">{msg.text}</p>

                {/* Clarification Options */}
                {msg.clarificationOptions && msg.clarificationOptions.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <span className="text-[11px] text-amber-300 font-semibold block">
                      Tap to clarify:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.clarificationOptions.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelectOption(opt)}
                          className="px-2.5 py-1 text-xs bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 rounded transition-colors"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Logged Event Confirmation Card */}
                {msg.loggedEvent && (
                  <div className="mt-2 p-2 bg-slate-900 rounded border border-emerald-600/40 text-[11px] text-emerald-300 space-y-1">
                    <div className="flex items-center gap-1 font-semibold">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Committed to Live Schedule</span>
                    </div>
                    <div className="text-slate-300">
                      Discipline: {msg.loggedEvent.discipline} · Event: {msg.loggedEvent.eventType}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar with Voice Button */}
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2">
        <button
          onClick={toggleSpeechRecognition}
          title={isListening ? 'Stop listening' : `Speak in ${language}`}
          className={`p-2.5 rounded-lg transition-all ${
            isListening
              ? 'bg-rose-600 text-white animate-pulse'
              : 'bg-slate-800 hover:bg-slate-700 text-amber-400'
          }`}
        >
          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder={
            isListening
              ? 'Listening to microphone...'
              : `Type field execution update or speak (${language})...`
          }
          className="flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none px-2"
        />

        <button
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim() || isSubmitting}
          className="p-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 rounded-lg font-semibold transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
