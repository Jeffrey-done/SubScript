<script>
	export default {
		onLaunch: function() {
			console.log('App Launch')
		}
	}
</script>

<style>
	/* Global Reset & Tailwind-like Utilities for UniApp */
    :root, page {
        --bg-background: #f1f5f9;
        --bg-surface: #ffffff;
        --text-main: #0f172a;
        --text-muted: #64748b;
        --border-color: #cbd5e1;
        --primary: #6366f1;
    }

    /* Dark Mode Simulation handled by .dark class on container */
    .dark {
        --bg-background: #0f172a;
        --bg-surface: #1e293b;
        --text-main: #f8fafc;
        --text-muted: #94a3b8;
        --border-color: #334155;
    }

    .page-container {
        min-height: 100vh;
        background-color: var(--bg-background);
        color: var(--text-main);
        transition: background-color 0.3s, color 0.3s;
        font-family: system-ui, -apple-system, sans-serif;
    }

    /* Backgrounds */
    .bg-background { background-color: var(--bg-background); }
    .bg-surface { background-color: var(--bg-surface); }
    .bg-primary { background-color: var(--primary); }
    .bg-slate-100 { background-color: #f1f5f9; }
    .bg-slate-200 { background-color: #e2e8f0; }
    
    .dark .bg-slate-800 { background-color: #1e293b; }
    .dark .bg-slate-900 { background-color: #0f172a; }

    /* Text */
    .text-main { color: var(--text-main); }
    .text-muted { color: var(--text-muted); }
    .text-white { color: #ffffff; }
    .text-primary { color: var(--primary); }
    .text-red-500 { color: #ef4444; }
    .text-emerald-500 { color: #10b981; }
    .text-xs { font-size: 12px; }
    .text-sm { font-size: 14px; }
    .text-lg { font-size: 18px; }
    .text-xl { font-size: 20px; }
    .text-2xl { font-size: 24px; }
    .text-3xl { font-size: 30px; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }

    /* Borders */
    .border { border-width: 1px; border-style: solid; }
    .border-border { border-color: var(--border-color); }
    .rounded { border-radius: 4px; }
    .rounded-lg { border-radius: 8px; }
    .rounded-xl { border-radius: 12px; }
    .rounded-2xl { border-radius: 16px; }
    .rounded-full { border-radius: 9999px; }

    /* Flex */
    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .items-center { align-items: center; }
    .items-end { align-items: flex-end; }
    .justify-between { justify-content: space-between; }
    .justify-center { justify-content: center; }
    .gap-1 { gap: 4px; }
    .gap-2 { gap: 8px; }
    .gap-3 { gap: 12px; }
    .gap-4 { gap: 16px; }
    .gap-6 { gap: 24px; }
    .flex-1 { flex: 1; }
    .shrink-0 { flex-shrink: 0; }

    /* Spacing */
    .p-1 { padding: 4px; }
    .p-2 { padding: 8px; }
    .p-4 { padding: 16px; }
    .p-5 { padding: 20px; }
    .p-6 { padding: 24px; }
    .px-4 { padding-left: 16px; padding-right: 16px; }
    .py-2 { padding-top: 8px; padding-bottom: 8px; }
    .py-3 { padding-top: 12px; padding-bottom: 12px; }
    .mb-1 { margin-bottom: 4px; }
    .mb-2 { margin-bottom: 8px; }
    .mb-4 { margin-bottom: 16px; }
    .mb-6 { margin-bottom: 24px; }
    .mt-1 { margin-top: 4px; }
    .mt-4 { margin-top: 16px; }
    
    /* Layout */
    .w-full { width: 100%; }
    .h-full { height: 100%; }
    .w-8 { width: 32px; } .h-8 { height: 32px; }
    .w-10 { width: 40px; } .h-10 { height: 40px; }
    .w-14 { width: 56px; } .h-14 { height: 56px; }
    .relative { position: relative; }
    .absolute { position: absolute; }
    .fixed { position: fixed; }
    .top-0 { top: 0; }
    .bottom-0 { bottom: 0; }
    .left-0 { left: 0; }
    .right-0 { right: 0; }
    .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
    .z-10 { z-index: 10; }
    .z-30 { z-index: 30; }
    .z-50 { z-index: 50; }
    .overflow-hidden { overflow: hidden; }

    /* Misc */
    .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
    .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); }
    .backdrop-blur { backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
    .opacity-50 { opacity: 0.5; }
    
    /* Animations */
    .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 300ms; }
</style>