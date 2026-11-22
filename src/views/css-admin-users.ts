// Users-only styles; the shared stylesheet imports this after its base rules.
export const adminUsersCss = String.raw`
.admin-users{--users-radius:12px;position:relative}
.admin-users .users-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
.admin-users .user-tools{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.admin-users .users-search{display:flex;align-items:center;gap:10px;flex:1 1 220px;min-width:180px;max-width:360px;min-height:44px;padding:0 12px;background:var(--surface);border:1px solid var(--line2);border-radius:8px;color:var(--text2)}
.admin-users .users-search:focus-within{outline:2px solid var(--accent);outline-offset:2px}
.admin-users .users-search input{width:100%;min-width:0;background:transparent;border:0;color:var(--text);font:inherit;padding:10px 0;outline:none}
.admin-users .users-search input::-webkit-search-cancel-button{display:none}
.admin-users .users-search input::placeholder{color:var(--text2)}
.admin-users .users-search .i{width:18px;height:18px;flex:none}
.admin-users .users-search kbd{border:1px solid var(--line2);border-radius:4px;padding:0 6px;font-size:12px;line-height:20px;color:var(--text2)}
.admin-users .users-search .btn{min-width:44px;min-height:44px;margin:-1px -12px -1px 0;border:0;background:transparent;font-size:22px}
.admin-users .users-filters{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.admin-users .users-filters .btn{min-height:44px;gap:6px;border-color:transparent;background:transparent;color:var(--text2);padding:8px 10px;border-radius:7px}
.admin-users .users-filters .btn span{font-size:11px;font-variant-numeric:tabular-nums;color:var(--text2);background:var(--side);padding:1px 5px;border-radius:4px;min-width:20px;text-align:center}
.admin-users .users-filters .btn[aria-pressed=true]{background:var(--soft);color:var(--accent);box-shadow:inset 0 0 0 1px var(--line)}
.admin-users .users-filters .btn:hover{background:var(--side);color:var(--text)}
.admin-users #users-summary{font-size:12px;font-variant-numeric:tabular-nums}
.admin-users .users-layout{grid-template-columns:minmax(0,1fr) 300px;gap:20px;align-items:start}
.admin-users #users-list{overflow:visible;border-radius:var(--users-radius);background:var(--surface)}
.admin-users .users-table{table-layout:fixed;font-size:12px}
.admin-users .users-table th{position:sticky;top:0;z-index:2;background:var(--surface);color:var(--text2);padding:12px 8px;box-shadow:0 1px 0 var(--line);font-size:11px}
.admin-users .users-table th:first-child{width:44px;border-top-left-radius:var(--users-radius);padding:0}
.admin-users .users-table th:nth-child(2){width:25%}
.admin-users .users-table th:last-child{border-top-right-radius:var(--users-radius)}
.admin-users .users-table td{padding:15px 8px;vertical-align:middle;border-bottom:1px solid var(--line);color:var(--text);overflow-wrap:anywhere}
.admin-users .users-table td:first-child{padding:0}
.admin-users .users-table tr:last-child td{border-bottom:0}
.admin-users .users-table tbody tr{cursor:pointer;transition:none}
.admin-users .btn{transition:none}
.admin-users .btn:active{transform:none}
.admin-users .users-table tbody tr:hover{background:var(--side)}
.admin-users .users-table tbody tr.is-selected{background:var(--soft)}
.admin-users .users-table tbody tr.is-current{box-shadow:inset 3px 0 var(--accent);background:var(--soft)}
.admin-users .users-table tbody tr:focus-within{outline:2px solid var(--accent);outline-offset:-2px}
.admin-users .users-check{display:flex;align-items:center;justify-content:center;width:44px;min-height:44px;cursor:pointer}
.admin-users .users-check input{width:18px;height:18px;min-height:18px;cursor:pointer;margin:0}
.admin-users .users-check:has(input:disabled){cursor:default;opacity:.45}
.admin-users .users-identity{display:flex;gap:10px;align-items:center;min-width:0}
.admin-users .users-identity .avatar{width:34px;height:34px}
.admin-users .users-name-copy{display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-width:0}
.admin-users .users-name-button{display:block;border:0;background:transparent;color:var(--text);font:inherit;font-weight:600;text-align:left;padding:0;cursor:pointer;overflow-wrap:anywhere;max-width:100%}
.admin-users .users-name-button:hover{color:var(--accent)}
.admin-users .users-badge{display:inline-flex;align-items:center;gap:5px;max-width:100%;padding:3px 7px;border:1px solid var(--line);border-radius:5px;background:var(--side);color:var(--text2);font-size:11px;line-height:1.35;overflow-wrap:anywhere}
.admin-users .users-state{padding:0;border:0;background:transparent;color:var(--text2);font-weight:400}
.admin-users .users-state::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--text3);flex:none}
.admin-users .users-state[data-state=Active]::before{background:var(--ok)}
.admin-users .users-state[data-state=Expired]::before{background:var(--warn)}
.admin-users .users-state[data-state=Disabled]::before{background:var(--bad)}
.admin-users .users-state[data-state=Admin]::before{background:var(--accent)}
.admin-users .users-access{background:var(--soft);color:var(--accent)}
.admin-users .users-access.unassigned{background:var(--side);color:var(--text2)}
.admin-users .users-badge.verified{background:color-mix(in srgb,var(--ok) 9%,var(--surface));color:var(--text)}
.admin-users .users-email-icon{width:13px;height:13px;flex:none}
.admin-users .verified .users-email-icon{color:var(--ok)}
.admin-users .users-table time{font-variant-numeric:tabular-nums}
.admin-users #user-panel{position:sticky;top:20px;padding:20px;border-radius:var(--users-radius);max-height:calc(100svh - 40px);overflow:auto;scrollbar-width:thin}
.admin-users #user-detail{position:relative;gap:20px;overflow-wrap:anywhere}
.admin-users .users-close{align-self:flex-end;min-height:36px;font-size:12px}
.admin-users .users-detail-heading{display:flex;align-items:center;gap:12px}
.admin-users .users-detail-heading .avatar{width:48px;height:48px;font-size:16px}
.admin-users .users-detail-heading h2{font-size:19px;letter-spacing:-.02em;line-height:1.3;margin-bottom:6px}
.admin-users .users-detail-section{padding-top:18px;border-top:1px solid var(--line);gap:10px}
.admin-users .users-detail-section h3{font-size:13px;font-weight:600;color:var(--text)}
.admin-users .users-detail-section label,.admin-users .users-detail-section p{font-size:12px;color:var(--text2)}
.admin-users .users-detail-section .field{color:var(--text)}
.admin-users .users-detail-section .actions{gap:6px;flex-wrap:wrap}
.admin-users .users-detail-section .actions .btn{flex:1;padding:6px;white-space:nowrap;font-size:12px;min-height:40px}
.admin-users .users-detail-section .btn{min-height:40px}
.admin-users .users-detail-section .users-badge{align-self:flex-start}
.admin-users .users-email{word-break:break-word}
.admin-users .users-danger h3{color:var(--bad)}
.admin-users .users-notice{font-size:12px;padding:10px 12px;background:var(--soft);border-radius:6px;color:var(--text)}
.admin-users .users-notice.err{background:var(--side);color:var(--bad)}
.admin-users .users-notice:empty{display:none}
.admin-users .users-empty{padding:56px 24px;text-align:center}
.admin-users .users-empty p{margin:8px 0 20px}
.admin-users .users-bulk{position:sticky;bottom:16px;z-index:5;display:flex;align-items:center;gap:12px;flex-wrap:wrap;width:fit-content;max-width:100%;margin:0 auto;padding:12px 16px;background:var(--surface);color:var(--text);border:1px solid var(--line2);border-radius:12px;box-shadow:0 4px 12px var(--line),0 12px 36px var(--line)}
.admin-users .users-bulk strong{font-size:13px;font-variant-numeric:tabular-nums;white-space:nowrap}
.admin-users .users-bulk label{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text2)}
.admin-users .users-bulk .field{margin:0;width:120px}
.admin-users .users-bulk .btn{min-height:44px}
.admin-users #bulk-results:empty{display:none}
.admin-users #bulk-results{font-size:13px;overflow-wrap:anywhere}
.admin-users .users-skeleton>div{display:grid;grid-template-columns:34px 2fr 1fr 1fr;gap:20px;padding:20px 16px;align-items:center;border-bottom:1px solid var(--line)}
.admin-users .users-skeleton i{width:34px;height:34px;border-radius:50%;background:var(--side)}
.admin-users .users-skeleton span{height:12px;background:var(--side);border-radius:4px}
.admin-users #users-sheet{padding:24px;margin:auto auto 0;width:min(600px,100%);max-width:100%;max-height:90svh;border:1px solid var(--line2);border-bottom:0;border-radius:18px 18px 0 0;background:var(--surface);color:var(--text);overscroll-behavior:contain}
.admin-users #users-sheet::backdrop{background:rgb(0 0 0 / .5)}
.admin-users :is(button,input,select):focus-visible{outline:2px solid var(--accent);outline-offset:3px}
@media(max-width:1200px){
 .admin-users .users-layout{grid-template-columns:minmax(0,1fr)}
 .admin-users #user-panel{display:none}
 .admin-users .users-search{max-width:none}
}
@media(max-width:700px){
 .admin-users .user-tools{gap:12px}
 .admin-users .users-search{flex-basis:100%}
 .admin-users .users-search input{font-size:16px}
 .admin-users .users-search kbd{display:none}
 .admin-users .users-filters{width:100%;gap:2px}
 .admin-users .users-filters .btn{flex:1;min-width:0;gap:4px;padding:8px 5px;font-size:12px;flex-wrap:wrap}
 .admin-users #users-list{border:0;background:transparent;box-shadow:none}
 .admin-users .users-table,.admin-users .users-table tbody{display:block}
 .admin-users .users-table thead{position:static;display:block;width:auto;height:auto;clip-path:none;overflow:visible}
 .admin-users .users-table thead tr{display:block;border:0;padding:0 0 8px;background:none}
 .admin-users .users-table thead th:nth-child(n){display:none}
 .admin-users .users-table thead th:first-child{display:flex;position:static;align-items:center;width:auto;background:none;box-shadow:none;border:0}
 .admin-users .users-table thead th:first-child::after{content:'Select all visible';font-size:12px}
 .admin-users .users-table tbody tr{display:grid;grid-template-columns:44px minmax(0,1fr);padding:12px;margin-bottom:10px;border:1px solid var(--line2);border-radius:10px;background:var(--surface)}
 .admin-users .users-table td:nth-child(n){display:flex;gap:12px;align-items:center;padding:7px 0;min-height:30px;border:0;grid-column:2;font-size:13px}
 .admin-users .users-table td::before{content:attr(data-label);flex:0 0 78px;font-size:12px;color:var(--text2)}
 .admin-users .users-table td:first-child{grid-column:1;grid-row:1;align-self:start}
 .admin-users .users-table td:nth-child(2){grid-column:2;padding-bottom:14px}
 .admin-users .users-table td:first-child::before,.admin-users .users-table td:nth-child(2)::before{display:none}
 .admin-users .users-name-button{min-height:28px;font-size:14px}
 .admin-users .users-bulk{bottom:8px;gap:8px;padding:12px;width:100%}
 .admin-users .users-bulk strong{margin-right:auto}
 .admin-users .users-bulk label{flex:1;justify-content:flex-end}
 .admin-users .users-bulk .field{width:100%;max-width:130px}
 .admin-users .users-bulk #bulk-days-wrap{flex-basis:100%}
 .admin-users .users-bulk>.btn{flex:1}
 .admin-users #users-sheet{padding:20px 16px max(24px,env(safe-area-inset-bottom))}
 .admin-users #users-sheet .field{font-size:16px}
}
@media(prefers-reduced-motion:no-preference){
 .admin-users .btn{transition:background-color 120ms ease,transform 100ms ease}
 .admin-users .btn:active{transform:translateY(1px)}
 .admin-users .users-table tbody tr,.admin-users .users-filters .btn{transition:background-color 120ms ease,box-shadow 120ms ease}
 .admin-users .users-bulk{animation:users-selection-in 180ms ease-out both}
 .admin-users #users-sheet[open]{animation:users-sheet-in 220ms ease-out both}
 .admin-users .users-skeleton span,.admin-users .users-skeleton i{animation:users-loading 1.4s ease-in-out infinite alternate}
 @keyframes users-selection-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
 @keyframes users-sheet-in{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
 @keyframes users-loading{from{opacity:.45}to{opacity:1}}
}
.invites-split{grid-template-columns:minmax(280px,380px) minmax(0,1fr)}
.invite-pending .admin-table td[data-label="Sent to"]{overflow-wrap:anywhere;min-width:160px}
.invite-pending .admin-table td[data-label="Status"]{min-width:130px}
.invite-pending details{padding:12px 16px;border-top:1px solid var(--line)}
.invite-pending summary{cursor:pointer;font-weight:500}
@media(max-width:900px){.invites-split{grid-template-columns:1fr}}
.invite-preview{display:block;width:100%;height:600px;margin-top:8px;border:1px solid var(--line2);border-radius:12px;background:#f1f0ec}
.level-choices{display:flex;flex-wrap:wrap;gap:8px;border:0;padding:0;margin:0 0 10px;min-width:0}
.level-choice{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border:1px solid var(--line2);border-radius:999px;cursor:pointer}
.level-choice:has(input:checked){border-color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,transparent)}
.level-choice:has(input:focus-visible){outline:2px solid var(--accent);outline-offset:2px}
`;
