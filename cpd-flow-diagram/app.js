/* ============================================================
   CPD Flow Diagram - Enhanced Application Logic v2
   + Step Number Badges on Arrows
   + ASR AI stops when customer answers (Kondisi 1)
   ============================================================ */

// ===== Constants =====
const ALL_NODE_IDS = ["node-db","node-autodialer","node-sbc","node-telco","node-customer","node-asr","node-agent"];
const ALL_CONN_IDS = ["conn-db-ad","conn-ad-sbc","conn-sbc-telco","conn-telco-cust","conn-sbc-asr","conn-ad-agent","conn-ad-telco"];
const ALL_LABEL_IDS = ["lbl-ad-sbc","lbl-sbc-telco","lbl-sbc-asr","lbl-ad-telco"];
const ALL_HIDDEN_IDS = ["conn-asr-ad","lbl-asr-ad","conn-cust-agent","lbl-cust-agent","conn-telco-voice","lbl-telco-voice","conn-ad-telco","lbl-ad-telco"];
const GLOW_CLASSES = ["glow-amber","glow-green","glow-red","glow-blue","glow-purple","glow-cyan"];
const BASE_STEP_DURATION = 3500;

// Color map for step marker badges
const MARKER_COLORS = {
    amber:  { bg: "#d97706", text: "#fff" },
    blue:   { bg: "#2563eb", text: "#fff" },
    green:  { bg: "#059669", text: "#fff" },
    red:    { bg: "#dc2626", text: "#fff" },
    purple: { bg: "#7c3aed", text: "#fff" },
    cyan:   { bg: "#0891b2", text: "#fff" },
    gray:   { bg: "#475569", text: "#fff" },
};

/// ===== State =====
let currentScenario = null;
let currentStep = -1;
let isPlaying = false;
let animationTimer = null;
let subTimers = [];
let speedMultiplier = 1;
let stepStartTime = 0;
let timerRAF = null;
let flowPackets = [];
let useCPD = true; // Default Menggunakan CPD


// ===== Step Marker Positions per Scenario (With CPD) =====
// Each step has an array of markers: { x, y, color }
// The step number (1-indexed) is automatically derived from the step index.
const stepMarkerMapWithCPD = {
    1: [ // Kondisi 1 — Call Answered
        [ // Step 1: Autodialer invite
            { x: 120, y: 135, color: "blue" },    // DB → Autodialer
            { x: 300, y: 225, color: "amber" },   // Autodialer → SBC
        ],
        [ // Step 2: VOXAGRID Analisa Early Audio
            { x: 480, y: 335, color: "red" },     // SBC → ASR
            { x: 645, y: 225, color: "amber" },   // SBC → Telco
        ],
        [ // Step 3: Ringing
            { x: 910, y: 225, color: "amber" },   // Telco → Customer
        ],
        [ // Step 4: Answer + ASR Stops
            { x: 945, y: 225, color: "green" },   // Customer Answered
        ],
        [ // Step 5: Distribute to Agent
            { x: 120, y: 342, color: "cyan" },    // Autodialer → Agent
        ],
        [ // Step 6: Talking
            { x: 620, y: 550, color: "green" },   // Customer ↔ Agent voice
        ],
        [ // Step 7: Hangup
            // No arrow marker
        ],
    ],
    2: [ // Kondisi 2 — Call Rejected
        [ // Step 1
            { x: 120, y: 135, color: "blue" },
            { x: 300, y: 225, color: "amber" },
        ],
        [ // Step 2
            { x: 480, y: 335, color: "red" },
            { x: 645, y: 225, color: "amber" },
        ],
        [ // Step 3: Ringing
            { x: 910, y: 225, color: "amber" },
        ],
        [ // Step 4: Reject
            { x: 945, y: 225, color: "red" },
        ],
        [ // Step 5: Voice Notification & Terminate Request
            { x: 620, y: 350, color: "purple" },  // Telco → SBC voice
            { x: 315, y: 440, color: "red" },     // ASR → Autodialer Request Terminate
        ],
        [ // Step 6: Hangup
        ],
    ],
    3: [ // Kondisi 3 — Nomor Tidak Aktif
        [ // Step 1
            { x: 120, y: 135, color: "blue" },
            { x: 300, y: 225, color: "amber" },
        ],
        [ // Step 2
            { x: 480, y: 335, color: "red" },
            { x: 645, y: 225, color: "amber" },
        ],
        [ // Step 3: Ringing
            { x: 925, y: 225, color: "amber" },
        ],
        [ // Step 4: Voice Notification & Terminate Request
            { x: 620, y: 350, color: "purple" },  // Telco → SBC voice
            { x: 315, y: 440, color: "red" },     // ASR → Autodialer Request Terminate
        ],
        [ // Step 5: Hangup
        ],
    ],
};

// ===== Step Marker Positions per Scenario (Without CPD) =====
const stepMarkerMapWithoutCPD = {
    1: [ // Kondisi 1 — Call Answered
        [ // Step 1
            { x: 120, y: 135, color: "blue" },
            { x: 466, y: 225, color: "amber" },
        ],
        [ // Step 2: Ringing
            { x: 910, y: 225, color: "amber" },
        ],
        [ // Step 3: Answer
            { x: 945, y: 225, color: "green" },
        ],
        [ // Step 4: Distribute to Agent
            { x: 120, y: 342, color: "cyan" },
        ],
        [ // Step 5: Talking
            { x: 620, y: 550, color: "green" },
        ],
        [ // Step 6: Hangup
        ],
    ],
    2: [ // Kondisi 2 — Call Rejected
        [ // Step 1
            { x: 120, y: 135, color: "blue" },
            { x: 466, y: 225, color: "amber" },
        ],
        [ // Step 2: Ringing
            { x: 910, y: 225, color: "amber" },
        ],
        [ // Step 3: Reject
            { x: 945, y: 225, color: "red" },
        ],
        [ // Step 4: Voice Notification (Normal Loop)
            { x: 440, y: 225, color: "purple" },
        ],
        [ // Step 5: Telco Timeout (SIP 480 Response)
            { x: 490, y: 225, color: "red" },
        ],
        [ // Step 6: Hangup
        ],
    ],
    3: [ // Kondisi 3 — Nomor Tidak Aktif
        [ // Step 1
            { x: 120, y: 135, color: "blue" },
            { x: 466, y: 225, color: "amber" },
        ],
        [ // Step 2: Nomor Tidak Aktif
            { x: 925, y: 225, color: "gray" },
        ],
        [ // Step 3: Voice Notification (Normal Loop)
            { x: 440, y: 225, color: "purple" },
        ],
        [ // Step 4: Telco Timeout (SIP 480 Response)
            { x: 490, y: 225, color: "red" },
        ],
        [ // Step 5: Hangup
        ],
    ],
};

const stepFocusMapWithoutCPD = {
    1: [466, 950, 950, 150, 550, 550],  // Scenario 1
    2: [466, 950, 950, 466, 466, 550],  // Scenario 2
    3: [466, 950, 466, 466, 550],       // Scenario 3
};

// Focus X coordinates per scenario step for mobile auto-scrolling
const stepFocusMapWithCPD = {
    1: [250, 480, 950, 950, 150, 550, 550],  // Scenario 1
    2: [250, 480, 950, 950, 550, 550],       // Scenario 2
    3: [250, 480, 950, 550, 550],            // Scenario 3
};


// ===== Scenario Definitions (With CPD) =====
const scenariosWithCPD = {
    1: {
        title: "Kondisi 1 — Call Di Answer Oleh Customer",
        subtitle: "Customer mengangkat telepon → terhubung ke Agent → percakapan",
        steps: [
            {
                label: "Autodialer Invite Call",
                sublabel: "SIP INVITE → VOXAGRID",
                duration: 3500,
                description: '<strong>Engine AUTODIALER</strong> mengambil nomor <span class="hl-amber">081287264002</span> dari database, lalu mengirim <span class="hl-blue">SIP INVITE</span> ke <span class="hl-amber">VOXAGRID SBC</span> untuk memulai panggilan.',
                apply(ctx) {
                    ctx.glowNode("node-db", "glow-blue");
                    ctx.glowNode("node-autodialer", "glow-blue");
                    ctx.glowNode("node-sbc", "glow-amber");
                    ctx.activateConn("conn-db-ad", "active", true);
                    ctx.activateConn("conn-ad-sbc", "active", true);
                    ctx.activateLabel("lbl-ad-sbc", "active");
                    ctx.showAdStatus("📤 SENDING SIP INVITE...");
                    ctx.flowPacketsOnPath("conn-db-ad", "amber", 600, 3);
                    ctx.at(500, () => ctx.flowPacketsOnPath("conn-ad-sbc", "amber", 800, 4));
                }
            },
            {
                label: "VOXAGRID Analisa Early Audio",
                sublabel: "ASR AI Pipeline Active",
                duration: 3500,
                description: '<span class="hl-amber">VOXAGRID SBC</span> menerima panggilan dan langsung mengaktifkan pipeline <span class="hl-red">ASR AI (Detect Early Audio)</span> untuk memantau audio secara real-time. Semua suara yang masuk akan dianalisa oleh AI.',
                apply(ctx) {
                    ctx.glowNode("node-sbc", "glow-amber");
                    ctx.glowNode("node-asr", "glow-red");
                    ctx.activateConn("conn-ad-sbc", "active", false);
                    ctx.activateConn("conn-sbc-asr", "active", true);
                    ctx.activateConn("conn-sbc-telco", "active", true);
                    ctx.activateLabel("lbl-ad-sbc", "active");
                    ctx.activateLabel("lbl-sbc-asr", "active");
                    ctx.activateLabel("lbl-sbc-telco", "active");
                    ctx.showSbcWaveform(true);
                    ctx.showAdStatus("📡 CALL IN PROGRESS");
                    ctx.flowPacketsOnPath("conn-sbc-asr", "red", 700, 3);
                    ctx.at(300, () => ctx.flowPacketsOnPath("conn-sbc-telco", "amber", 800, 3));
                }
            },
            {
                label: "📱 Mobile Customer Ringing",
                sublabel: "🔔 Berdering...",
                duration: 4500,
                description: 'Panggilan berhasil diteruskan oleh <span class="hl-purple">Telco Provider</span>. Handphone customer <span class="hl-amber">berdering (ringing)</span>... Menunggu customer mengangkat telepon. ASR AI tetap memantau audio.',
                apply(ctx) {
                    ctx.glowNode("node-telco", "glow-purple");
                    ctx.glowNode("node-customer", "glow-amber");
                    ctx.activateConn("conn-ad-sbc", "active", false);
                    ctx.activateConn("conn-sbc-telco", "active", true);
                    ctx.activateConn("conn-telco-cust", "active", true);
                    ctx.activateConn("conn-sbc-asr", "active", false);
                    ctx.showSbcWaveform(true);
                    ctx.startRinging();
                    ctx.setPhoneScreen("📞", "#f59e0b");
                    ctx.setCustomerStatus("🔔 RINGING...", "#f59e0b");
                }
            },
            {
                label: "✅ Mobile Customer Answer → ASR AI Stop",
                sublabel: "Call Connected — ASR Stopped",
                duration: 4000,
                description: 'Customer <span class="hl-green">mengangkat telepon (Answer)!</span> Karena call sudah di-answer oleh manusia (bukan voice notification), <span class="hl-red">ASR AI (Detect Early Audio)</span> otomatis <strong>berhenti / dihentikan</strong>. Pipeline audio detection tidak lagi diperlukan.',
                apply(ctx) {
                    ctx.stopRinging();
                    ctx.glowNode("node-customer", "glow-green");
                    ctx.glowNode("node-sbc", "glow-amber");
                    ctx.getNode("node-customer").classList.add("answered");
                    ctx.activateConn("conn-ad-sbc", "success", false);
                    ctx.activateConn("conn-sbc-telco", "success", true);
                    ctx.activateConn("conn-telco-cust", "success", false);
                    // ASR AI STOPS — no longer analyzing
                    ctx.getNode("node-asr").classList.add("dim");
                    ctx.showSbcWaveform(false);
                    ctx.showAsrStopped(true);
                    ctx.showAnswerWaves(true);
                    ctx.setPhoneScreen("✅", "#10b981");
                    ctx.setCustomerStatus("✅ ANSWERED", "#10b981");
                    ctx.showAdStatus("✅ CALL ANSWERED");
                }
            },
            {
                label: "🎧 Call Didistribusikan ke Agent",
                sublabel: "Agent Connected",
                duration: 4000,
                description: 'Call didistribusikan ke <span class="hl-cyan">Group of Agents</span>. Salah satu agent menerima panggilan. Customer dan Agent sekarang terhubung. <span class="hl-red">ASR AI</span> tetap dalam keadaan <strong>stopped</strong>.',
                apply(ctx) {
                    ctx.glowNode("node-autodialer", "glow-blue");
                    ctx.glowNode("node-agent", "glow-cyan");
                    ctx.glowNode("node-customer", "glow-green");
                    ctx.activateConn("conn-ad-sbc", "success", false);
                    ctx.activateConn("conn-sbc-telco", "success", false);
                    ctx.activateConn("conn-telco-cust", "success", false);
                    ctx.activateConn("conn-ad-agent", "success", true);
                    ctx.showHidden("conn-cust-agent", "success", true);
                    ctx.showHidden("lbl-cust-agent", "success", false);
                    ctx.showAnswerWaves(true);
                    ctx.setPhoneScreen("✅", "#10b981");
                    ctx.setCustomerStatus("✅ CONNECTED", "#10b981");
                    ctx.showAdStatus("🎧 → AGENT");
                    ctx.showAgentActive(true);
                    // ASR remains stopped
                    ctx.getNode("node-asr").classList.add("dim");
                    ctx.showAsrStopped(true);
                    ctx.flowPacketsOnPath("conn-ad-agent", "green", 700, 3);
                }
            },
            {
                label: "🗣️ Customer Talking ke Agent",
                sublabel: "Percakapan berlangsung",
                duration: 5000,
                description: 'Customer <span class="hl-green">sedang berbicara</span> dengan Agent melalui sambungan telepon. Percakapan dua arah berlangsung normal. <span class="hl-red">ASR AI</span> tetap <strong>stopped</strong> — tidak diperlukan lagi. 🗣️',
                apply(ctx) {
                    ctx.glowNode("node-customer", "glow-green");
                    ctx.glowNode("node-agent", "glow-cyan");
                    ctx.activateConn("conn-ad-sbc", "success", false);
                    ctx.activateConn("conn-sbc-telco", "success", false);
                    ctx.activateConn("conn-telco-cust", "success", false);
                    ctx.activateConn("conn-ad-agent", "success", false);
                    ctx.showHidden("conn-cust-agent", "success", true);
                    ctx.showHidden("lbl-cust-agent", "success", false);
                    ctx.setPhoneScreen("🗣️", "#10b981");
                    ctx.setCustomerStatus("🗣️ IN CALL", "#10b981");
                    ctx.showAdStatus("🗣️ IN CONVERSATION");
                    ctx.showAgentActive(true);
                    ctx.showSpeechBubbles(true);
                    // ASR remains stopped
                    ctx.getNode("node-asr").classList.add("dim");
                    ctx.showAsrStopped(true);
                }
            },
            {
                label: "📞 Hangup",
                sublabel: "Call Ended",
                duration: 3000,
                description: 'Percakapan selesai. Call di-<span class="hl-red">hangup</span>. Sesi panggilan berakhir dengan <span class="hl-green">normal/sukses</span>.',
                apply(ctx) {
                    ctx.dimAllNodes();
                    ctx.showSpeechBubbles(false);
                    ctx.showAgentActive(false);
                    ctx.showAnswerWaves(false);
                    ctx.showAsrStopped(false);
                    ctx.setPhoneScreen("📱", "#64748b");
                    ctx.setCustomerStatus("", null);
                    ctx.showAdStatus("");
                    ctx.showHangup(true);
                }
            }
        ]
    },
    2: {
        title: "Kondisi 2 — Call Di Reject Oleh Customer",
        subtitle: "Customer menolak panggilan → ASR AI deteksi voice notification → auto terminate",
        steps: [
            {
                label: "Autodialer Invite Call",
                sublabel: "SIP INVITE → VOXAGRID",
                duration: 3500,
                description: '<strong>Engine AUTODIALER</strong> mengambil nomor <span class="hl-amber">081287264002</span> dari database, lalu mengirim <span class="hl-blue">SIP INVITE</span> ke <span class="hl-amber">VOXAGRID SBC</span> untuk memulai panggilan.',
                apply(ctx) {
                    ctx.glowNode("node-db", "glow-blue");
                    ctx.glowNode("node-autodialer", "glow-blue");
                    ctx.glowNode("node-sbc", "glow-amber");
                    ctx.activateConn("conn-db-ad", "active", true);
                    ctx.activateConn("conn-ad-sbc", "active", true);
                    ctx.activateLabel("lbl-ad-sbc", "active");
                    ctx.showAdStatus("📤 SENDING SIP INVITE...");
                    ctx.flowPacketsOnPath("conn-db-ad", "amber", 600, 3);
                    ctx.at(500, () => ctx.flowPacketsOnPath("conn-ad-sbc", "amber", 800, 4));
                }
            },
            {
                label: "VOXAGRID Analisa Early Audio",
                sublabel: "ASR AI Pipeline Active",
                duration: 3500,
                description: '<span class="hl-amber">VOXAGRID SBC</span> mengaktifkan pipeline <span class="hl-red">ASR AI (Detect Early Audio)</span> untuk memantau audio secara real-time. Semua suara dianalisa untuk mendeteksi voice notification.',
                apply(ctx) {
                    ctx.glowNode("node-sbc", "glow-amber");
                    ctx.glowNode("node-asr", "glow-red");
                    ctx.activateConn("conn-ad-sbc", "active", false);
                    ctx.activateConn("conn-sbc-asr", "active", true);
                    ctx.activateConn("conn-sbc-telco", "active", true);
                    ctx.activateLabel("lbl-ad-sbc", "active");
                    ctx.activateLabel("lbl-sbc-asr", "active");
                    ctx.activateLabel("lbl-sbc-telco", "active");
                    ctx.showSbcWaveform(true);
                    ctx.showAdStatus("📡 CALL IN PROGRESS");
                    ctx.flowPacketsOnPath("conn-sbc-asr", "red", 700, 3);
                }
            },
            {
                label: "📱 Mobile Customer Ringing",
                sublabel: "🔔 Berdering...",
                duration: 4000,
                description: 'Handphone customer <span class="hl-amber">berdering (ringing)</span>... Panggilan masuk terlihat di layar customer. ASR AI tetap aktif memantau audio.',
                apply(ctx) {
                    ctx.glowNode("node-telco", "glow-purple");
                    ctx.glowNode("node-customer", "glow-amber");
                    ctx.activateConn("conn-ad-sbc", "active", false);
                    ctx.activateConn("conn-sbc-telco", "active", true);
                    ctx.activateConn("conn-telco-cust", "active", true);
                    ctx.activateConn("conn-sbc-asr", "active", false);
                    ctx.showSbcWaveform(true);
                    ctx.startRinging();
                    ctx.setPhoneScreen("📞", "#f59e0b");
                    ctx.setCustomerStatus("🔔 RINGING...", "#f59e0b");
                }
            },
            {
                label: "❌ Mobile Customer Reject",
                sublabel: "Panggilan Ditolak!",
                duration: 3500,
                description: 'Customer melihat panggilan masuk dan <span class="hl-red">MENOLAK panggilan (Reject/Decline)</span>. Customer menekan tombol reject di handphone.',
                apply(ctx) {
                    ctx.stopRinging();
                    ctx.glowNode("node-customer", "glow-red");
                    ctx.getNode("node-customer").classList.add("rejected");
                    ctx.activateConn("conn-ad-sbc", "active", false);
                    ctx.activateConn("conn-sbc-telco", "active", false);
                    ctx.activateConn("conn-telco-cust", "danger", false);
                    ctx.activateConn("conn-sbc-asr", "active", false);
                    ctx.showSbcWaveform(true);
                    ctx.showRejectEffect(true);
                    ctx.setPhoneScreen("❌", "#ef4444");
                    ctx.setCustomerStatus("❌ REJECTED", "#ef4444");
                }
            },
            {
                label: '🔊 Voice Notification & Terminate Request',
                sublabel: 'Early Audio Match → Terminate',
                duration: 6000,
                description: 'Karena panggilan di-reject, <span class="hl-purple">Telco Provider</span> mengirimkan <span class="hl-red">voice notification</span>. ASR AI secara paralel menganalisa audio. Ketika keyword <strong>"nomor"</strong> match (0.8s), tepat 2 detik kemudian (2.8s) ASR AI langsung mengirim <span class="hl-red">Request Terminate</span> ke <span class="hl-blue">Autodialer Engine</span>.',
                apply(ctx) {
                    ctx.showRejectEffect(false);
                    ctx.glowNode("node-telco", "glow-purple");
                    ctx.getNode("node-telco").classList.add("transmitting"); // Blinking
                    ctx.glowNode("node-sbc", "glow-amber");
                    ctx.activateConn("conn-ad-sbc", "active", false);
                    ctx.activateConn("conn-sbc-telco", "active", false);
                    ctx.activateConn("conn-sbc-asr", "active", true);
                    ctx.showHidden("conn-telco-voice", "danger", true);
                    ctx.showHidden("lbl-telco-voice", "danger", false);
                    ctx.showSbcWaveform(true);
                    ctx.setCustomerStatus("❌ REJECTED", "#ef4444");

                    // Set voice notification texts dynamically
                    ctx.setVoiceTexts('"Nomor yang anda tuju', "sedang sibuk /", 'dialihkan..."');
                    ctx.showVoiceNotification(true);
                    
                    // Reveal voice texts step-by-step
                    ctx.at(400, () => ctx.revealVoiceText("voice-text-1"));
                    ctx.at(1200, () => ctx.revealVoiceText("voice-text-2"));
                    ctx.at(2000, () => ctx.revealVoiceText("voice-text-3"));
                    ctx.at(1000, () => ctx.showSoundWaves(true));
                    
                    // ASR AI starts blinking immediately in parallel
                    ctx.glowNode("node-asr", "glow-red");
                    ctx.getNode("node-asr").classList.add("detecting");
                    ctx.showAsrBlink(true);
                    
                    // ASR AI checks matched phrases in parallel
                    ctx.showAsrKeywords(true);
                    ctx.at(800, () => ctx.revealKeyword("kw-1"));   // "nomor" ✓
                    ctx.at(1600, () => ctx.revealKeyword("kw-2"));  // "sibuk" ✓
                    ctx.at(2400, () => ctx.revealKeyword("kw-3"));  // "dialihkan" ✓

                    ctx.flowPacketsOnPath("conn-telco-voice", "purple", 1000, 5);

                    // AFTER 2 SECONDS FROM MATCH (800ms + 2000ms = 2800ms): Request Terminate immediately!
                    ctx.at(2800, () => {
                        ctx.showHidden("conn-asr-ad", "danger", true);
                        ctx.showHidden("lbl-asr-ad", "danger", false);
                        ctx.glowNode("node-autodialer", "glow-blue");
                        ctx.showTerminateSignal(true);
                        ctx.showAdStatus("⛔ TERMINATE RECEIVED");
                        ctx.flowPacketsOnPath("conn-asr-ad", "red", 1400, 5);
                    });
                }
            },
            {
                label: "📞 Hangup",
                sublabel: "Call Terminated",
                duration: 3000,
                description: 'Call di-<span class="hl-red">hangup</span> secara otomatis oleh sistem. ASR AI berhasil mendeteksi voice notification dan menghentikan panggilan — menghemat waktu dan biaya.',
                apply(ctx) {
                    ctx.dimAllNodes();
                    ctx.showTerminateSignal(false);
                    ctx.showRejectEffect(false);
                    ctx.setPhoneScreen("📱", "#64748b");
                    ctx.setCustomerStatus("", null);
                    ctx.showAdStatus("");
                    ctx.showHangup(true);
                }
            }
        ]
    },
    3: {
        title: "Kondisi 3 — Nomor Tidak Aktif / True Caller / Flight Mode",
        subtitle: "Nomor tidak bisa dihubungi → Telco kirim notifikasi → ASR AI auto terminate",
        steps: [
            {
                label: "Autodialer Invite Call",
                sublabel: "SIP INVITE → VOXAGRID",
                duration: 3500,
                description: '<strong>Engine AUTODIALER</strong> mengambil nomor <span class="hl-amber">081287264002</span> dari database dan mengirim <span class="hl-blue">SIP INVITE</span> ke <span class="hl-amber">VOXAGRID SBC</span>.',
                apply(ctx) {
                    ctx.glowNode("node-db", "glow-blue");
                    ctx.glowNode("node-autodialer", "glow-blue");
                    ctx.glowNode("node-sbc", "glow-amber");
                    ctx.activateConn("conn-db-ad", "active", true);
                    ctx.activateConn("conn-ad-sbc", "active", true);
                    ctx.activateLabel("lbl-ad-sbc", "active");
                    ctx.showAdStatus("📤 SENDING SIP INVITE...");
                    ctx.flowPacketsOnPath("conn-db-ad", "amber", 600, 3);
                    ctx.at(500, () => ctx.flowPacketsOnPath("conn-ad-sbc", "amber", 800, 4));
                }
            },
            {
                label: "VOXAGRID Analisa Early Audio",
                sublabel: "ASR AI Pipeline Active",
                duration: 3500,
                description: '<span class="hl-amber">VOXAGRID SBC</span> mengaktifkan pipeline <span class="hl-red">ASR AI (Detect Early Audio)</span>. Audio stream di-monitor secara real-time untuk mendeteksi voice notification.',
                apply(ctx) {
                    ctx.glowNode("node-sbc", "glow-amber");
                    ctx.glowNode("node-asr", "glow-red");
                    ctx.activateConn("conn-ad-sbc", "active", false);
                    ctx.activateConn("conn-sbc-asr", "active", true);
                    ctx.activateConn("conn-sbc-telco", "active", true);
                    ctx.activateLabel("lbl-sbc-asr", "active");
                    ctx.activateLabel("lbl-sbc-telco", "active");
                    ctx.showSbcWaveform(true);
                    ctx.showAdStatus("📡 CALL IN PROGRESS");
                    ctx.flowPacketsOnPath("conn-sbc-asr", "red", 700, 3);
                }
            },
            {
                label: "📵 Telco Deteksi: Nomor Tidak Aktif",
                sublabel: "Unreachable / Flight Mode",
                duration: 4000,
                description: '<span class="hl-purple">Telco Provider</span> mencoba menghubungi nomor customer namun mendeteksi bahwa <span class="hl-red">nomor tidak aktif</span>. Penyebab: HP dimatikan, Flight Mode, nomor diblokir (True Caller), atau nomor tidak terdaftar.',
                apply(ctx) {
                    ctx.glowNode("node-telco", "glow-purple");
                    ctx.glowNode("node-customer", "glow-red");
                    ctx.activateConn("conn-ad-sbc", "active", false);
                    ctx.activateConn("conn-sbc-telco", "active", true);
                    ctx.activateConn("conn-telco-cust", "danger", false);
                    ctx.activateConn("conn-sbc-asr", "active", false);
                    ctx.showSbcWaveform(true);
                    ctx.showInactiveEffect(true);
                    ctx.setPhoneScreen("📵", "#6b7280");
                    ctx.setCustomerStatus("📵 NOT ACTIVE", "#6b7280");
                }
            },
            {
                label: '🔊 Voice Notification & Terminate Request',
                sublabel: 'Early Audio Match → Terminate',
                duration: 6000,
                description: 'Karena nomor tidak aktif, <span class="hl-purple">Telco Provider</span> mengirimkan <span class="hl-red">voice notification</span>. ASR AI secara paralel menganalisa audio. Ketika keyword <strong>"nomor"</strong> match (0.8s), tepat 2 detik kemudian (2.8s) ASR AI langsung mengirim <span class="hl-red">Request Terminate</span> ke <span class="hl-blue">Autodialer Engine</span>.',
                apply(ctx) {
                    ctx.glowNode("node-telco", "glow-purple");
                    ctx.getNode("node-telco").classList.add("transmitting"); // Blinking
                    ctx.glowNode("node-sbc", "glow-amber");
                    ctx.activateConn("conn-ad-sbc", "active", false);
                    ctx.activateConn("conn-sbc-telco", "active", false);
                    ctx.activateConn("conn-sbc-asr", "active", true);
                    ctx.showHidden("conn-telco-voice", "danger", true);
                    ctx.showHidden("lbl-telco-voice", "danger", false);
                    ctx.showSbcWaveform(true);
                    ctx.showInactiveEffect(true);
                    ctx.setCustomerStatus("📵 NOT ACTIVE", "#6b7280");

                    // Set voice notification texts dynamically for Scenario 3
                    ctx.setVoiceTexts('"Nomor yang anda tuju', "tidak aktif atau tidak", 'dapat dihubungi..."');
                    ctx.showVoiceNotification(true);
                    
                    // Reveal voice texts step-by-step
                    ctx.at(400, () => ctx.revealVoiceText("voice-text-1"));
                    ctx.at(1200, () => ctx.revealVoiceText("voice-text-2"));
                    ctx.at(2000, () => ctx.revealVoiceText("voice-text-3"));
                    ctx.at(1000, () => ctx.showSoundWaves(true));
                    
                    // ASR AI starts blinking immediately in parallel
                    ctx.glowNode("node-asr", "glow-red");
                    ctx.getNode("node-asr").classList.add("detecting");
                    ctx.showAsrBlink(true);
                    
                    // ASR AI checks matched phrases in parallel
                    ctx.showAsrKeywords(true);
                    ctx.at(800, () => ctx.revealKeyword("kw-1"));   // "nomor" ✓
                    ctx.at(1600, () => ctx.revealKeyword("kw-4"));  // "tidak aktif" ✓

                    ctx.flowPacketsOnPath("conn-telco-voice", "purple", 1000, 5);

                    // AFTER 2 SECONDS FROM MATCH (800ms + 2000ms = 2800ms): Request Terminate immediately!
                    ctx.at(2800, () => {
                        ctx.showHidden("conn-asr-ad", "danger", true);
                        ctx.showHidden("lbl-asr-ad", "danger", false);
                        ctx.glowNode("node-autodialer", "glow-blue");
                        ctx.showTerminateSignal(true);
                        ctx.showAdStatus("⛔ TERMINATE RECEIVED");
                        ctx.flowPacketsOnPath("conn-asr-ad", "red", 1400, 5);
                    });
                }
            },
            {
                label: "📞 Hangup",
                sublabel: "Call Terminated",
                duration: 3000,
                description: 'Call di-<span class="hl-red">hangup</span> otomatis. ASR AI berhasil mendeteksi bahwa nomor tidak aktif melalui voice notification Telco — panggilan dihentikan tanpa perlu menunggu timeout.',
                apply(ctx) {
                    ctx.dimAllNodes();
                    ctx.showTerminateSignal(false);
                    ctx.showInactiveEffect(false);
                    ctx.setPhoneScreen("📱", "#64748b");
                    ctx.setCustomerStatus("", null);
                    ctx.showAdStatus("");
                    ctx.showHangup(true);
                }
            }
        ]
    }
};

// ===== Scenario Definitions (Without CPD) =====
const scenariosWithoutCPD = {
    1: {
        title: "Kondisi 1 — Call Di Answer Oleh Customer (Tanpa CPD)",
        subtitle: "Customer mengangkat telepon → terhubung ke Agent → percakapan",
        steps: [
            {
                label: "Autodialer Invite Call",
                sublabel: "SIP INVITE",
                duration: 3500,
                description: '<strong>Engine AUTODIALER</strong> mengambil nomor <span class="hl-amber">081287264002</span> dari database, lalu mengirim <span class="hl-blue">SIP INVITE</span> langsung ke <span class="hl-purple">Telco Provider</span> untuk memulai panggilan.',
                apply(ctx) {
                    ctx.glowNode("node-db", "glow-blue");
                    ctx.glowNode("node-autodialer", "glow-blue");
                    ctx.glowNode("node-telco", "glow-purple");
                    ctx.activateConn("conn-db-ad", "active", true);
                    ctx.showHidden("conn-ad-telco", "active", true);
                    ctx.showHidden("lbl-ad-telco", "active", false);
                    ctx.showAdStatus("📤 SENDING SIP INVITE...");
                    ctx.flowPacketsOnPath("conn-db-ad", "amber", 600, 3);
                    ctx.at(500, () => ctx.flowPacketsOnLine(215, 225, 718, 225, "amber", 1200, 4));
                }
            },
            {
                label: "📱 Mobile Customer Ringing",
                sublabel: "🔔 Berdering...",
                duration: 4500,
                description: 'Panggilan berhasil diteruskan oleh <span class="hl-purple">Telco Provider</span>. Handphone customer <span class="hl-amber">berdering (ringing)</span>... Menunggu customer mengangkat telepon.',
                apply(ctx) {
                    ctx.glowNode("node-telco", "glow-purple");
                    ctx.glowNode("node-customer", "glow-amber");
                    ctx.showHidden("conn-ad-telco", "active", false);
                    ctx.activateConn("conn-telco-cust", "active", true);
                    ctx.startRinging();
                    ctx.setPhoneScreen("📞", "#f59e0b");
                    ctx.setCustomerStatus("🔔 RINGING...", "#f59e0b");
                }
            },
            {
                label: "✅ Mobile Customer Answer",
                sublabel: "Call Connected",
                duration: 4000,
                description: 'Customer <span class="hl-green">mengangkat telepon (Answer)!</span> Customer dan Agent sekarang terhubung secara langsung.',
                apply(ctx) {
                    ctx.stopRinging();
                    ctx.glowNode("node-customer", "glow-green");
                    ctx.getNode("node-customer").classList.add("answered");
                    ctx.showHidden("conn-ad-telco", "success", false);
                    ctx.activateConn("conn-telco-cust", "success", false);
                    ctx.showAnswerWaves(true);
                    ctx.setPhoneScreen("✅", "#10b981");
                    ctx.setCustomerStatus("✅ ANSWERED", "#10b981");
                    ctx.showAdStatus("✅ CALL ANSWERED");
                }
            },
            {
                label: "🎧 Call Didistribusikan ke Agent",
                sublabel: "Agent Connected",
                duration: 4000,
                description: 'Call didistribusikan ke <span class="hl-cyan">Group of Agents</span>. Salah satu agent menerima panggilan. Customer dan Agent sekarang terhubung.',
                apply(ctx) {
                    ctx.glowNode("node-autodialer", "glow-blue");
                    ctx.glowNode("node-agent", "glow-cyan");
                    ctx.glowNode("node-customer", "glow-green");
                    ctx.showHidden("conn-ad-telco", "success", false);
                    ctx.activateConn("conn-telco-cust", "success", false);
                    ctx.activateConn("conn-ad-agent", "success", true);
                    ctx.showHidden("conn-cust-agent", "success", true);
                    ctx.showHidden("lbl-cust-agent", "success", false);
                    ctx.showAnswerWaves(true);
                    ctx.setPhoneScreen("✅", "#10b981");
                    ctx.setCustomerStatus("✅ CONNECTED", "#10b981");
                    ctx.showAdStatus("🎧 → AGENT");
                    ctx.showAgentActive(true);
                    ctx.flowPacketsOnPath("conn-ad-agent", "green", 700, 3);
                }
            },
            {
                label: "🗣️ Customer Talking ke Agent",
                sublabel: "Percakapan berlangsung",
                duration: 5000,
                description: 'Customer <span class="hl-green">sedang berbicara</span> dengan Agent melalui sambungan telepon. Percakapan dua arah berlangsung normal. 🗣️',
                apply(ctx) {
                    ctx.glowNode("node-customer", "glow-green");
                    ctx.glowNode("node-agent", "glow-cyan");
                    ctx.showHidden("conn-ad-telco", "success", false);
                    ctx.activateConn("conn-telco-cust", "success", false);
                    ctx.activateConn("conn-ad-agent", "success", false);
                    ctx.showHidden("conn-cust-agent", "success", true);
                    ctx.showHidden("lbl-cust-agent", "success", false);
                    ctx.setPhoneScreen("🗣️", "#10b981");
                    ctx.setCustomerStatus("🗣️ IN CALL", "#10b981");
                    ctx.showAdStatus("🗣️ IN CONVERSATION");
                    ctx.showAgentActive(true);
                    ctx.showSpeechBubbles(true);
                }
            },
            {
                label: "📞 Hangup",
                sublabel: "Call Ended",
                duration: 3000,
                description: 'Percakapan selesai. Call di-<span class="hl-red">hangup</span>. Sesi panggilan berakhir dengan <span class="hl-green">normal/sukses</span>.',
                apply(ctx) {
                    ctx.dimAllNodes();
                    ctx.showSpeechBubbles(false);
                    ctx.showAgentActive(false);
                    ctx.showAnswerWaves(false);
                    ctx.setPhoneScreen("📱", "#64748b");
                    ctx.setCustomerStatus("", null);
                    ctx.showAdStatus("");
                    ctx.showHangup(true);
                }
            }
        ]
    },
    2: {
        title: "Kondisi 2 — Call Di Reject Oleh Customer (Tanpa CPD)",
        subtitle: "Customer menolak panggilan → Diputar Voice Announcement 30 detik → Timeout",
        steps: [
            {
                label: "Autodialer Invite Call",
                sublabel: "SIP INVITE",
                duration: 3500,
                description: '<strong>Engine AUTODIALER</strong> mengambil nomor <span class="hl-amber">081287264002</span> dari database, lalu mengirim <span class="hl-blue">SIP INVITE</span> langsung ke <span class="hl-purple">Telco Provider</span> untuk memulai panggilan.',
                apply(ctx) {
                    ctx.glowNode("node-db", "glow-blue");
                    ctx.glowNode("node-autodialer", "glow-blue");
                    ctx.glowNode("node-telco", "glow-purple");
                    ctx.activateConn("conn-db-ad", "active", true);
                    ctx.showHidden("conn-ad-telco", "active", true);
                    ctx.showHidden("lbl-ad-telco", "active", false);
                    ctx.showAdStatus("📤 SENDING SIP INVITE...");
                    ctx.flowPacketsOnPath("conn-db-ad", "amber", 600, 3);
                    ctx.at(500, () => ctx.flowPacketsOnLine(215, 225, 718, 225, "amber", 1200, 4));
                }
            },
            {
                label: "📱 Mobile Customer Ringing",
                sublabel: "🔔 Berdering...",
                duration: 4000,
                description: 'Handphone customer <span class="hl-amber">berdering (ringing)</span>... Panggilan masuk terlihat di layar customer.',
                apply(ctx) {
                    ctx.glowNode("node-telco", "glow-purple");
                    ctx.glowNode("node-customer", "glow-amber");
                    ctx.showHidden("conn-ad-telco", "active", false);
                    ctx.activateConn("conn-telco-cust", "active", true);
                    ctx.startRinging();
                    ctx.setPhoneScreen("📞", "#f59e0b");
                    ctx.setCustomerStatus("🔔 RINGING...", "#f59e0b");
                }
            },
            {
                label: "❌ Mobile Customer Reject",
                sublabel: "Panggilan Ditolak!",
                duration: 3500,
                description: 'Customer melihat panggilan masuk dan <span class="hl-red">MENOLAK panggilan (Reject/Decline)</span>.',
                apply(ctx) {
                    ctx.stopRinging();
                    ctx.glowNode("node-customer", "glow-red");
                    ctx.getNode("node-customer").classList.add("rejected");
                    ctx.showHidden("conn-ad-telco", "active", false);
                    ctx.activateConn("conn-telco-cust", "danger", false);
                    ctx.showRejectEffect(true);
                    ctx.setPhoneScreen("❌", "#ef4444");
                    ctx.setCustomerStatus("❌ REJECTED", "#ef4444");
                }
            },
            {
                label: '🔊 Voice Notification (Normal Loop)',
                sublabel: 'Audio Loop & Timeout (30 Detik)',
                duration: 30000,
                description: 'Karena panggilan di-reject, <span class="hl-purple">Telco Provider</span> mengeluarkan voice notification seperti "Nomor yang anda tuju sedang sibuk..." yang diputar berulang-ulang selama 30 detik. Tanpa CPD, sistem membiarkan audio berjalan sampai batas timeout terlampaui.',
                apply(ctx) {
                    ctx.showRejectEffect(false);
                    ctx.glowNode("node-telco", "glow-purple");
                    ctx.getNode("node-telco").classList.add("transmitting");
                    ctx.showHidden("conn-ad-telco", "active", "reverse");
                    ctx.setCustomerStatus("❌ REJECTED", "#ef4444");

                    ctx.setVoiceTexts('"Nomor yang anda tuju', "sedang sibuk, cobalah", 'beberapa saat lagi..."');
                    ctx.showVoiceNotification(true);
                    
                    ctx.at(400, () => ctx.revealVoiceText("voice-text-1"));
                    ctx.at(1200, () => ctx.revealVoiceText("voice-text-2"));
                    ctx.at(2000, () => ctx.revealVoiceText("voice-text-3"));
                    ctx.at(1000, () => ctx.showSoundWaves(true));
                    
                    // Flow purple packets directly from Telco to Autodialer in reverse periodically
                    for (let delayMs = 0; delayMs < 30000; delayMs += 3000) {
                        ctx.at(delayMs, () => {
                            ctx.flowPacketsOnLine(718, 225, 215, 225, "purple", 1500, 4);
                        });
                    }

                    // Simulasikan hitung mundur 30 detik di status Autodialer
                    for (let i = 0; i <= 30; i += 5) {
                        ctx.at(i * 1000, () => {
                            ctx.showAdStatus(`⏳ TIMEOUT: ${30 - i}s`);
                        });
                    }
                }
            },
            {
                label: '⏳ Telco Timeout (SIP 480 Response)',
                sublabel: 'SIP 480 Temporarily Unavailable',
                duration: 4500,
                description: 'Setelah timeout 30 detik terlampaui, <span class="hl-purple">Telco Provider</span> mengirimkan response <span class="hl-red">SIP 480 Temporarily Unavailable</span> langsung ke <span class="hl-blue">Engine Autodialer</span>.',
                apply(ctx) {
                    ctx.glowNode("node-telco", "glow-purple");
                    ctx.glowNode("node-autodialer", "glow-blue");
                    ctx.showHidden("conn-ad-telco", "danger", "reverse");
                    ctx.showAdStatus("⏳ WAITING FOR SIP RESPONSE...");
                    
                    // Flow red packets from Telco directly to Autodialer
                    ctx.flowPacketsOnLine(718, 225, 215, 225, "red", 1500, 4);
                    ctx.at(1800, () => {
                        ctx.showAdStatus("⛔ SIP 480 RECEIVED");
                    });
                }
            },
            {
                label: "📞 Hangup",
                sublabel: "Call Terminated",
                duration: 3000,
                description: 'Autodialer Engine menerima response SIP 480 dan melakukan <span class="hl-red">hangup</span>. Panggilan berakhir setelah memakan waktu 30 detik penuh (inefisien).',
                apply(ctx) {
                    ctx.dimAllNodes();
                    ctx.setPhoneScreen("📱", "#64748b");
                    ctx.setCustomerStatus("", null);
                    ctx.showAdStatus("");
                    ctx.showHangup(true);
                }
            }
        ]
    },
    3: {
        title: "Kondisi 3 — Nomor Tidak Aktif (Tanpa CPD)",
        subtitle: "Nomor tidak aktif → Diputar Voice Announcement 30 detik → Timeout",
        steps: [
            {
                label: "Autodialer Invite Call",
                sublabel: "SIP INVITE",
                duration: 3500,
                description: '<strong>Engine AUTODIALER</strong> mengambil nomor <span class="hl-amber">081287264002</span> dari database dan mengirim <span class="hl-blue">SIP INVITE</span> langsung ke <span class="hl-purple">Telco Provider</span>.',
                apply(ctx) {
                    ctx.glowNode("node-db", "glow-blue");
                    ctx.glowNode("node-autodialer", "glow-blue");
                    ctx.glowNode("node-telco", "glow-purple");
                    ctx.activateConn("conn-db-ad", "active", true);
                    ctx.showHidden("conn-ad-telco", "active", true);
                    ctx.showHidden("lbl-ad-telco", "active", false);
                    ctx.showAdStatus("📤 SENDING SIP INVITE...");
                    ctx.flowPacketsOnPath("conn-db-ad", "amber", 600, 3);
                    ctx.at(500, () => ctx.flowPacketsOnLine(215, 225, 718, 225, "amber", 1200, 4));
                }
            },
            {
                label: "📵 Telco Deteksi: Nomor Tidak Aktif",
                sublabel: "Unreachable / Flight Mode",
                duration: 4000,
                description: '<span class="hl-purple">Telco Provider</span> mencoba menghubungi nomor customer namun mendeteksi bahwa <span class="hl-red">nomor tidak aktif</span> (HP mati, Flight Mode, dll).',
                apply(ctx) {
                    ctx.glowNode("node-telco", "glow-purple");
                    ctx.glowNode("node-customer", "glow-red");
                    ctx.showHidden("conn-ad-telco", "active", false);
                    ctx.activateConn("conn-telco-cust", "danger", false);
                    ctx.showInactiveEffect(true);
                    ctx.setPhoneScreen("📵", "#6b7280");
                    ctx.setCustomerStatus("📵 NOT ACTIVE", "#6b7280");
                }
            },
            {
                label: '🔊 Voice Notification (Normal Loop)',
                sublabel: 'Audio Loop & Timeout (30 Detik)',
                duration: 30000,
                description: 'Karena nomor tidak aktif, <span class="hl-purple">Telco Provider</span> memutar voice notification "Nomor yang anda tuju tidak aktif..." berulang-ulang selama 30 detik. Tanpa CPD, panggilan dibiarkan berjalan sampai timeout.',
                apply(ctx) {
                    ctx.glowNode("node-telco", "glow-purple");
                    ctx.getNode("node-telco").classList.add("transmitting");
                    ctx.showHidden("conn-ad-telco", "active", "reverse");
                    ctx.showInactiveEffect(true);
                    ctx.setCustomerStatus("📵 NOT ACTIVE", "#6b7280");

                    ctx.setVoiceTexts('"Nomor yang anda tuju', "tidak aktif atau tidak", 'dapat dihubungi..."');
                    ctx.showVoiceNotification(true);
                    
                    ctx.at(400, () => ctx.revealVoiceText("voice-text-1"));
                    ctx.at(1200, () => ctx.revealVoiceText("voice-text-2"));
                    ctx.at(2000, () => ctx.revealVoiceText("voice-text-3"));
                    ctx.at(1000, () => ctx.showSoundWaves(true));
                    
                    // Flow purple packets directly from Telco to Autodialer in reverse periodically
                    for (let delayMs = 0; delayMs < 30000; delayMs += 3000) {
                        ctx.at(delayMs, () => {
                            ctx.flowPacketsOnLine(718, 225, 215, 225, "purple", 1500, 4);
                        });
                    }

                    // Simulasikan hitung mundur 30 detik di status Autodialer
                    for (let i = 0; i <= 30; i += 5) {
                        ctx.at(i * 1000, () => {
                            ctx.showAdStatus(`⏳ TIMEOUT: ${30 - i}s`);
                        });
                    }
                }
            },
            {
                label: '⏳ Telco Timeout (SIP 480 Response)',
                sublabel: 'SIP 480 Temporarily Unavailable',
                duration: 4500,
                description: 'Setelah timeout 30 detik terlampaui, <span class="hl-purple">Telco Provider</span> mengirimkan response <span class="hl-red">SIP 480 Temporarily Unavailable</span> langsung ke <span class="hl-blue">Engine Autodialer</span>.',
                apply(ctx) {
                    ctx.glowNode("node-telco", "glow-purple");
                    ctx.glowNode("node-autodialer", "glow-blue");
                    ctx.showHidden("conn-ad-telco", "danger", "reverse");
                    ctx.showAdStatus("⏳ WAITING FOR SIP RESPONSE...");
                    
                    // Flow red packets from Telco directly to Autodialer
                    ctx.flowPacketsOnLine(718, 225, 215, 225, "red", 1500, 4);
                    ctx.at(1800, () => {
                        ctx.showAdStatus("⛔ SIP 480 RECEIVED");
                    });
                }
            },
            {
                label: "📞 Hangup",
                sublabel: "Call Terminated",
                duration: 3000,
                description: 'Autodialer Engine menerima response SIP 480 dan menutup panggilan. Panggilan memakan waktu total 30 detik penuh (sangat tidak hemat biaya).',
                apply(ctx) {
                    ctx.dimAllNodes();
                    ctx.setPhoneScreen("📱", "#64748b");
                    ctx.setCustomerStatus("", null);
                    ctx.showAdStatus("");
                    ctx.showHangup(true);
                }
            }
        ]
    }
};

let scenarios = scenariosWithCPD;
let stepMarkerMap = stepMarkerMapWithCPD;
let stepFocusMap = stepFocusMapWithCPD;

// ===== Global CPD Toggle Function =====
function setCPDMode(bool) {
    useCPD = bool;
    
    // Update button states
    const btnOn = document.getElementById("btn-cpd-on");
    const btnOff = document.getElementById("btn-cpd-off");
    const svg = document.getElementById("flow-svg");
    const asrInfo = document.getElementById("asr-info-card");
    
    if (bool) {
        if (btnOn) btnOn.classList.add("active");
        if (btnOff) btnOff.classList.remove("active");
        if (svg) svg.classList.remove("asr-disabled");
        if (asrInfo) asrInfo.style.display = "block";
        scenarios = scenariosWithCPD;
        stepMarkerMap = stepMarkerMapWithCPD;
        stepFocusMap = stepFocusMapWithCPD;
    } else {
        if (btnOn) btnOn.classList.remove("active");
        if (btnOff) btnOff.classList.add("active");
        if (svg) svg.classList.add("asr-disabled");
        if (asrInfo) asrInfo.style.display = "none";
        scenarios = scenariosWithoutCPD;
        stepMarkerMap = stepMarkerMapWithoutCPD;
        stepFocusMap = stepFocusMapWithoutCPD;
    }
    
    // Reset/Reload scenario if active
    if (currentScenario !== null) {
        selectScenario(currentScenario);
    }
}
window.setCPDMode = setCPDMode;


// ===== Step Marker Rendering =====
function renderStepMarkers(scenarioNum, upToStepIdx) {
    const g = document.getElementById("step-markers");
    g.innerHTML = "";
    const markerSteps = stepMarkerMap[scenarioNum];
    if (!markerSteps) return;

    for (let stepIdx = 0; stepIdx <= upToStepIdx && stepIdx < markerSteps.length; stepIdx++) {
        const markers = markerSteps[stepIdx];
        const isCurrent = (stepIdx === upToStepIdx);
        const stepNum = stepIdx + 1;

        markers.forEach(m => {
            const colorDef = MARKER_COLORS[m.color] || MARKER_COLORS.amber;
            const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
            group.classList.add("step-marker-group");

            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", m.x);
            circle.setAttribute("cy", m.y);
            circle.setAttribute("r", isCurrent ? "10" : "8");
            circle.setAttribute("fill", colorDef.bg);
            circle.setAttribute("stroke", "#0f172a");
            circle.setAttribute("stroke-width", "2");
            circle.classList.add("step-marker-circle");
            if (isCurrent) circle.classList.add("current");
            else circle.classList.add("completed");

            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", m.x);
            text.setAttribute("y", m.y + (isCurrent ? 3.5 : 3));
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("fill", colorDef.text);
            text.setAttribute("font-size", isCurrent ? "9" : "7.5");
            text.setAttribute("font-weight", "800");
            text.classList.add("step-marker-text");
            text.textContent = stepNum;

            group.appendChild(circle);
            group.appendChild(text);
            g.appendChild(group);
        });
    }
}


// ===== Animation Context =====
function createAnimContext() {
    return {
        getNode(id) { return document.getElementById(id); },
        glowNode(id, glowClass) {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.remove("dim", ...GLOW_CLASSES);
            el.classList.add(glowClass);
        },
        dimAllNodes() {
            ALL_NODE_IDS.forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.classList.remove(...GLOW_CLASSES, "highlight", "ringing", "answered", "rejected", "detecting", "transmitting"); el.classList.add("dim"); }
            });
        },
        activateConn(id, cls, flowing) {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.remove("active","success","danger","flowing","flowing-reverse");
            el.classList.add(cls);
            const markerMap = { active: "arrow-amber", success: "arrow-green", danger: "arrow-red" };
            const markerId = markerMap[cls] || "arrowhead";
            
            if (flowing === "reverse") {
                el.classList.add("flowing-reverse");
                el.setAttribute("marker-start", `url(#${markerId})`);
                el.setAttribute("marker-end", "none");
            } else {
                if (flowing) el.classList.add("flowing");
                el.setAttribute("marker-end", `url(#${markerId})`);
                el.removeAttribute("marker-start");
            }
        },
        activateLabel(id, cls) {
            const el = document.getElementById(id);
            if (el) el.classList.add(cls);
        },
        showHidden(id, cls, flowing) {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.remove("conn-hidden");
            el.classList.add("conn-visible", cls);
            el.classList.remove("flowing","flowing-reverse");
            const markerMap = { active: "arrow-amber", success: "arrow-green", danger: "arrow-red" };
            const markerId = markerMap[cls] || "arrowhead";
            
            if (flowing === "reverse") {
                el.classList.add("flowing-reverse");
                el.setAttribute("marker-start", `url(#${markerId})`);
                el.setAttribute("marker-end", "none");
            } else {
                if (flowing) el.classList.add("flowing");
                el.setAttribute("marker-end", `url(#${markerId})`);
                el.removeAttribute("marker-start");
            }
        },
        startRinging() {
            document.getElementById("node-customer").classList.add("ringing");
            document.getElementById("ring-waves").style.display = "block";
        },
        stopRinging() {
            document.getElementById("node-customer").classList.remove("ringing");
            document.getElementById("ring-waves").style.display = "none";
        },
        showAnswerWaves(show) { document.getElementById("answer-waves").style.display = show ? "block" : "none"; },
        showRejectEffect(show) { document.getElementById("reject-effect").style.display = show ? "block" : "none"; },
        showInactiveEffect(show) { document.getElementById("inactive-effect").style.display = show ? "block" : "none"; },
        setPhoneScreen(icon, color) {
            const el = document.getElementById("phone-screen-icon");
            if (el) { el.textContent = icon; el.setAttribute("fill", color); }
        },
        setCustomerStatus(text, color) {
            const badge = document.getElementById("cust-status-badge");
            const bg = document.getElementById("cust-status-bg");
            const txt = document.getElementById("cust-status-text");
            if (!text) { badge.setAttribute("opacity", "0"); return; }
            badge.setAttribute("opacity", "1");
            bg.setAttribute("fill", color);
            txt.textContent = text;
        },
        showAdStatus(text) {
            const bar = document.getElementById("ad-status-bar");
            const txt = document.getElementById("ad-status-text");
            if (!text) { bar.setAttribute("opacity","0"); txt.setAttribute("opacity","0"); return; }
            bar.setAttribute("opacity","1"); txt.setAttribute("opacity","1");
            txt.textContent = text;
        },
        showSbcWaveform(show) { document.getElementById("sbc-waveform").setAttribute("opacity", show ? "1" : "0"); },
        showAgentActive(show) { document.getElementById("agent-active-indicator").setAttribute("opacity", show ? "1" : "0"); },
        showSpeechBubbles(show) {
            const el = document.getElementById("speech-bubbles");
            el.style.display = show ? "block" : "none";
            if (show) {
                document.getElementById("speech-customer").setAttribute("opacity","1");
                document.getElementById("speech-agent").setAttribute("opacity","1");
            }
        },
        showVoiceNotification(show) {
            document.getElementById("voice-notif-display").style.display = show ? "block" : "none";
            if (!show) {
                ["voice-text-1","voice-text-2","voice-text-3"].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) { el.setAttribute("opacity","0"); el.style.animation = ""; }
                });
            }
        },
        revealVoiceText(id) {
            const el = document.getElementById(id);
            if (el) { el.setAttribute("opacity","1"); el.style.animation = "fadeIn 0.5s ease forwards"; }
        },
        setVoiceTexts(t1, t2, t3) {
            const el1 = document.getElementById("voice-text-1");
            const el2 = document.getElementById("voice-text-2");
            const el3 = document.getElementById("voice-text-3");
            if (el1) el1.textContent = t1;
            if (el2) el2.textContent = t2;
            if (el3) el3.textContent = t3;
        },
        showSoundWaves(show) {
            document.querySelectorAll(".sound-arc").forEach(a => a.setAttribute("opacity", show ? "0.7" : "0"));
        },
        showAsrBlink(show) { document.getElementById("asr-blink-overlay").style.display = show ? "block" : "none"; },
        showAsrStopped(show) { document.getElementById("asr-stopped").style.display = show ? "block" : "none"; },
        showAsrKeywords(show) {
            document.getElementById("asr-keywords").style.display = show ? "block" : "none";
            if (!show) {
                ["kw-1","kw-2","kw-3","kw-4"].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) { el.setAttribute("opacity","0"); el.style.animation = ""; }
                });
            }
        },
        revealKeyword(id) {
            const el = document.getElementById(id);
            if (el) { el.setAttribute("opacity","1"); el.style.animation = "fadeIn 0.4s ease forwards"; }
        },
        showTerminateSignal(show) { document.getElementById("terminate-signal").style.display = show ? "block" : "none"; },
        showHangup(show) {
            document.getElementById("status-overlays").style.display = show ? "block" : "none";
            document.getElementById("overlay-hangup").style.display = show ? "block" : "none";
        },
        at(delayMs, fn) {
            const adjusted = delayMs / speedMultiplier;
            subTimers.push(setTimeout(fn, adjusted));
        },
        flowPacketsOnLine(x1, y1, x2, y2, color, durationMs, count) {
            const g = document.getElementById("flow-packets");
            for (let i = 0; i < count; i++) {
                const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circle.setAttribute("r", "4");
                circle.classList.add("flow-packet", color);
                circle.setAttribute("cx", x1);
                circle.setAttribute("cy", y1);
                g.appendChild(circle);
                const delay = i * (durationMs / count / speedMultiplier);
                const dur = durationMs / speedMultiplier;
                setTimeout(() => {
                    const startTime = performance.now();
                    function animate(now) {
                        const elapsed = now - startTime;
                        const t = Math.min(elapsed / dur, 1);
                        circle.setAttribute("cx", x1 + (x2 - x1) * t);
                        circle.setAttribute("cy", y1 + (y2 - y1) * t);
                        circle.setAttribute("opacity", t < 0.9 ? 1 : 1 - (t - 0.9) * 10);
                        if (t < 1) requestAnimationFrame(animate);
                        else circle.remove();
                    }
                    requestAnimationFrame(animate);
                }, delay);
            }
        },
        flowPacketsOnPath(pathId, color, durationMs, count) {
            const path = document.getElementById(pathId);
            if (!path) return;
            const pathLength = path.getTotalLength();
            const g = document.getElementById("flow-packets");
            for (let i = 0; i < count; i++) {
                const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circle.setAttribute("r", "4");
                circle.classList.add("flow-packet", color);
                g.appendChild(circle);
                const delay = i * (durationMs / count / speedMultiplier);
                const dur = durationMs / speedMultiplier;
                setTimeout(() => {
                    const startTime = performance.now();
                    function animate(now) {
                        const elapsed = now - startTime;
                        const t = Math.min(elapsed / dur, 1);
                        const point = path.getPointAtLength(t * pathLength);
                        circle.setAttribute("cx", point.x);
                        circle.setAttribute("cy", point.y);
                        circle.setAttribute("opacity", t < 0.9 ? 1 : 1 - (t - 0.9) * 10);
                        if (t < 1) requestAnimationFrame(animate);
                        else circle.remove();
                    }
                    requestAnimationFrame(animate);
                }, delay);
            }
        }
    };
}


// Auto-scroll diagram container to focus on active step elements on mobile
function scrollToFocus(focusX) {
    const container = document.getElementById('diagram-container');
    if (!container || focusX === undefined || container.classList.contains('fit-mode')) return;
    
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;
    
    // Map focusX from SVG coordinate system (1220 width) to actual scroll position
    const ratio = scrollWidth / 1220;
    const targetScrollLeft = (focusX * ratio) - (clientWidth / 2);
    
    container.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: 'smooth'
    });
}

// Toggle Fit vs Zoom (scrollable) mode on mobile
function toggleZoomMode() {
    const container = document.getElementById('diagram-container');
    const btn = document.getElementById('btn-zoom-toggle');
    if (!container || !btn) return;
    
    const txt = btn.querySelector('.zoom-text');
    const isFitMode = container.classList.toggle('fit-mode');
    
    if (isFitMode) {
        if (txt) txt.textContent = "Zoom In";
        const hint = document.getElementById('swipe-hint');
        if (hint) hint.style.display = 'none';
    } else {
        if (txt) txt.textContent = "Fit Screen";
        const hint = document.getElementById('swipe-hint');
        if (hint) hint.style.display = 'flex';
        
        // Re-scroll to current step focus
        if (currentScenario && stepFocusMap[currentScenario]) {
            const focusPoints = stepFocusMap[currentScenario];
            if (currentStep >= 0 && currentStep < focusPoints.length) {
                setTimeout(() => scrollToFocus(focusPoints[currentStep]), 100);
            }
        }
    }
}

// Rebind Swipe Hint scroll event listener
function rebindSwipeHint() {
    const container = document.getElementById('diagram-container');
    const hint = document.getElementById('swipe-hint');
    if (container && hint) {
        hint.style.display = 'flex';
        hint.style.opacity = '1';
        hint.style.transition = '';
        container.removeEventListener('scroll', handleScrollDismiss);
        container.addEventListener('scroll', handleScrollDismiss);
    }
}

// Handler to dismiss swipe hint on scroll
function handleScrollDismiss() {
    const container = document.getElementById('diagram-container');
    const hint = document.getElementById('swipe-hint');
    if (hint) {
        hint.style.opacity = '0';
        hint.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            if (hint.style.opacity === '0') hint.style.display = 'none';
        }, 300);
    }
    if (container) {
        container.removeEventListener('scroll', handleScrollDismiss);
    }
}


// ===== Core Functions =====

function selectScenario(num) {
    currentScenario = num;
    currentStep = -1;
    isPlaying = false;
    document.querySelectorAll('.scenario-card').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-scenario-${num}`).classList.add('active');
    const flowSection = document.getElementById('flow-section');
    flowSection.style.display = 'block';
    flowSection.style.animation = 'fadeInUp 0.5s ease forwards';
    document.getElementById('flow-title-text').textContent = scenarios[num].title;
    buildTimeline(scenarios[num].steps);
    resetDiagram();
    updateProgress();
    document.getElementById('step-badge').textContent = 'Ready';
    document.getElementById('step-text').textContent = `Klik "Play" untuk memulai animasi — ${scenarios[num].subtitle}`;
    document.getElementById('step-description').classList.remove('active');
    document.getElementById('btn-play').style.display = 'flex';
    document.getElementById('btn-pause').style.display = 'none';

    // Reset zoom and swipe hint state based on screen size
    const container = document.getElementById('diagram-container');
    if (container) {
        if (window.innerWidth < 768) {
            container.classList.add('fit-mode');
            const zoomText = document.querySelector('#btn-zoom-toggle .zoom-text');
            if (zoomText) zoomText.textContent = "Zoom In";
            const hint = document.getElementById('swipe-hint');
            if (hint) hint.style.display = 'none';
        } else {
            container.classList.remove('fit-mode');
            const zoomText = document.querySelector('#btn-zoom-toggle .zoom-text');
            if (zoomText) zoomText.textContent = "Fit Screen";
            rebindSwipeHint();
        }
    }

    setTimeout(() => flowSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

function buildTimeline(steps) {
    const container = document.getElementById('timeline-container');
    container.innerHTML = '';
    steps.forEach((step, idx) => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.id = `timeline-${idx}`;
        item.innerHTML = `
            <div class="timeline-dot"></div>
            <div class="timeline-label">${step.label}</div>
            <div class="timeline-sublabel">${step.sublabel}</div>
            <div class="timeline-duration">⏱️ ${(step.duration / 1000).toFixed(1)}s</div>
        `;
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => goToStep(idx));
        container.appendChild(item);
    });
}

function resetDiagram() {
    subTimers.forEach(t => clearTimeout(t));
    subTimers = [];
    document.getElementById("flow-packets").innerHTML = "";
    document.getElementById("step-markers").innerHTML = "";

    ALL_NODE_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove("dim","highlight","ringing","answered","rejected","detecting","transmitting",...GLOW_CLASSES);
    });
    ALL_CONN_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) { 
            el.classList.remove("active","success","danger","flowing","flowing-reverse"); 
            el.setAttribute("marker-end","url(#arrowhead)"); 
            el.removeAttribute("marker-start");
        }
    });
    ALL_LABEL_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove("active","success","danger");
    });
    ALL_HIDDEN_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) { 
            el.classList.remove("conn-visible","active","success","danger","flowing","flowing-reverse"); 
            el.classList.add("conn-hidden"); 
            el.setAttribute("marker-end","url(#arrowhead)"); 
            el.removeAttribute("marker-start");
        }
    });

    ["status-overlays","ring-waves","answer-waves","reject-effect","inactive-effect",
     "speech-bubbles","voice-notif-display","asr-blink-overlay","asr-keywords","terminate-signal","asr-stopped"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });
    document.getElementById("overlay-hangup").style.display = "none";

    const ctx = createAnimContext();
    ctx.setPhoneScreen("📱", "#64748b");
    ctx.setCustomerStatus("", null);
    ctx.showAdStatus("");
    ctx.showSbcWaveform(false);
    ctx.showAgentActive(false);

    ["voice-text-1","voice-text-2","voice-text-3"].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.setAttribute("opacity","0"); el.style.animation = ""; }
    });
    ["kw-1","kw-2","kw-3","kw-4"].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.setAttribute("opacity","0"); el.style.animation = ""; }
    });
    document.querySelectorAll(".sound-arc").forEach(a => a.setAttribute("opacity","0"));
    document.querySelectorAll('.timeline-item').forEach(item => item.classList.remove('active','completed'));
    updateTimerDisplay(0);
}

function applyStep(stepIdx) {
    if (!currentScenario || !scenarios[currentScenario]) return;
    const steps = scenarios[currentScenario].steps;
    if (stepIdx < 0 || stepIdx >= steps.length) return;

    subTimers.forEach(t => clearTimeout(t));
    subTimers = [];
    document.getElementById("flow-packets").innerHTML = "";

    resetDiagram();

    currentStep = stepIdx;
    const step = steps[stepIdx];

    // Apply step logic
    const ctx = createAnimContext();
    step.apply(ctx);

    // Render step markers on arrows (accumulated up to current step)
    renderStepMarkers(currentScenario, stepIdx);

    // Update timeline
    document.querySelectorAll('.timeline-item').forEach((item, idx) => {
        item.classList.remove('active','completed');
        if (idx < stepIdx) item.classList.add('completed');
        if (idx === stepIdx) item.classList.add('active');
    });

    document.getElementById('step-badge').textContent = `Step ${stepIdx + 1}`;
    document.getElementById('step-text').innerHTML = step.description;
    document.getElementById('step-description').classList.add('active');
    updateProgress();

    // Auto-scroll diagram to center the focused element on mobile
    if (currentScenario && stepFocusMap[currentScenario]) {
        const focusPoints = stepFocusMap[currentScenario];
        if (stepIdx >= 0 && stepIdx < focusPoints.length) {
            scrollToFocus(focusPoints[stepIdx]);
        }
    }

    // Auto-scroll horizontal timeline stepper to center the active step on mobile
    const activeTimelineItem = document.getElementById(`timeline-${stepIdx}`);
    if (activeTimelineItem) {
        activeTimelineItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    stepStartTime = performance.now();
    startStepTimer(step.duration / speedMultiplier);
}

function goToStep(idx) { pauseAnimation(); applyStep(idx); }

function playAnimation() {
    if (!currentScenario) return;
    const steps = scenarios[currentScenario].steps;
    isPlaying = true;
    document.getElementById('btn-play').style.display = 'none';
    document.getElementById('btn-pause').style.display = 'flex';
    if (currentStep >= steps.length - 1) { currentStep = -1; resetDiagram(); }

    function nextStep() {
        if (!isPlaying) return;
        currentStep++;
        if (currentStep >= steps.length) {
            isPlaying = false;
            document.getElementById('btn-play').style.display = 'flex';
            document.getElementById('btn-pause').style.display = 'none';
            return;
        }
        applyStep(currentStep);
        animationTimer = setTimeout(nextStep, steps[currentStep].duration / speedMultiplier);
    }
    nextStep();
}

function pauseAnimation() {
    isPlaying = false;
    if (animationTimer) { clearTimeout(animationTimer); animationTimer = null; }
    if (timerRAF) { cancelAnimationFrame(timerRAF); timerRAF = null; }
    document.getElementById('btn-play').style.display = 'flex';
    document.getElementById('btn-pause').style.display = 'none';
}

function resetAnimation() {
    pauseAnimation();
    currentStep = -1;
    resetDiagram();
    updateProgress();
    if (currentScenario && scenarios[currentScenario]) {
        document.getElementById('step-badge').textContent = 'Ready';
        document.getElementById('step-text').textContent = `Klik "Play" untuk memulai animasi — ${scenarios[currentScenario].subtitle}`;
        document.getElementById('step-description').classList.remove('active');
    }
}

function goBack() {
    pauseAnimation();
    currentStep = -1; currentScenario = null;
    document.getElementById('flow-section').style.display = 'none';
    document.querySelectorAll('.scenario-card').forEach(b => b.classList.remove('active'));
    document.getElementById('scenario-selector').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setSpeed(speed, btn) {
    speedMultiplier = speed;
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function updateProgress() {
    if (!currentScenario || !scenarios[currentScenario]) {
        document.getElementById('progress-bar').style.width = '0%';
        document.getElementById('progress-text').textContent = 'Step 0 / 0';
        return;
    }
    const total = scenarios[currentScenario].steps.length;
    const current = currentStep + 1;
    document.getElementById('progress-bar').style.width = `${(current/total)*100}%`;
    document.getElementById('progress-text').textContent = `Step ${current} / ${total}`;
}

function startStepTimer(durationMs) {
    if (timerRAF) cancelAnimationFrame(timerRAF);
    const start = performance.now();
    function tick(now) {
        const elapsed = now - start;
        updateTimerDisplay(Math.min(elapsed / 1000, durationMs / 1000));
        if (elapsed < durationMs) timerRAF = requestAnimationFrame(tick);
    }
    timerRAF = requestAnimationFrame(tick);
}

function updateTimerDisplay(seconds) {
    const el = document.getElementById("timer-text");
    if (el) el.textContent = seconds.toFixed(1) + "s";
}


// ===== Particle Background =====
function initParticles() {
    const canvas = document.getElementById('particleCanvas');
    const ctx2d = canvas.getContext('2d');
    let particles = [];
    const MAX = 50;
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize(); window.addEventListener('resize', resize);
    class Particle {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random()*canvas.width; this.y = Math.random()*canvas.height;
            this.size = Math.random()*2+0.5;
            this.speedX = (Math.random()-0.5)*0.3; this.speedY = (Math.random()-0.5)*0.3;
            this.opacity = Math.random()*0.3+0.05;
            this.hue = Math.random()>0.5?38:220;
        }
        update() { this.x+=this.speedX; this.y+=this.speedY; if(this.x<0||this.x>canvas.width)this.speedX*=-1; if(this.y<0||this.y>canvas.height)this.speedY*=-1; }
        draw() { ctx2d.beginPath(); ctx2d.arc(this.x,this.y,this.size,0,Math.PI*2); ctx2d.fillStyle=`hsla(${this.hue},80%,60%,${this.opacity})`; ctx2d.fill(); }
    }
    for(let i=0;i<MAX;i++) particles.push(new Particle());
    function connectParticles() {
        for(let i=0;i<particles.length;i++) for(let j=i+1;j<particles.length;j++) {
            const dx=particles[i].x-particles[j].x, dy=particles[i].y-particles[j].y, dist=Math.sqrt(dx*dx+dy*dy);
            if(dist<150) { ctx2d.beginPath(); ctx2d.moveTo(particles[i].x,particles[i].y); ctx2d.lineTo(particles[j].x,particles[j].y); ctx2d.strokeStyle=`rgba(148,163,184,${(1-dist/150)*0.08})`; ctx2d.lineWidth=0.5; ctx2d.stroke(); }
        }
    }
    function animate() { ctx2d.clearRect(0,0,canvas.width,canvas.height); particles.forEach(p=>{p.update();p.draw();}); connectParticles(); requestAnimationFrame(animate); }
    animate();
}

document.addEventListener('DOMContentLoaded', () => { 
    initParticles(); 
    rebindSwipeHint();
    
    // Auto-fit on mobile on load
    const container = document.getElementById('diagram-container');
    if (container && window.innerWidth < 768) {
        container.classList.add('fit-mode');
        const zoomText = document.querySelector('#btn-zoom-toggle .zoom-text');
        if (zoomText) zoomText.textContent = "Zoom In";
        const hint = document.getElementById('swipe-hint');
        if (hint) hint.style.display = 'none';
    }
});
