// Styles for the admin Security page. Owned by the admin-security UI; appended to the shared stylesheet by css.ts.
export const adminSecurityCss = String.raw`
.admin-security{min-width:0;overflow-wrap:anywhere}
.admin-security .security-page{width:100%}
.admin-security #security-root,.admin-security #security-loading{gap:24px}
.admin-security .card{border-radius:12px}
.admin-security .pad{padding:24px}
.admin-security h2,.admin-security h3,.admin-security p{margin:0}
.admin-security h2{font-size:18px;line-height:1.4}
.admin-security h3{font-size:14px;line-height:1.5;font-weight:600}
.admin-security .muted{color:var(--text2);font-size:13px;line-height:1.6}
.admin-security .security-heading{display:grid;gap:8px;margin-bottom:16px}
.admin-security .security-summary{display:flex;align-items:center;justify-content:space-between;gap:24px;border-left:4px solid var(--security-tone);background:color-mix(in srgb,var(--security-tone) 5%,var(--surface))}
.admin-security [data-state=ok]{--security-tone:var(--ok)}
.admin-security [data-state=warn]{--security-tone:var(--warn)}
.admin-security [data-state=bad]{--security-tone:var(--bad)}
.admin-security [data-state=info]{--security-tone:var(--text2)}
.admin-security #security-posture{font-size:26px;letter-spacing:-.02em;margin:8px 0;line-height:1.2}
.admin-security #security-summary-detail{color:var(--text2);font-size:14px}
.admin-security .security-refresh{display:grid;justify-items:end;gap:8px;flex:none}
.admin-security #security-checked{font-variant-numeric:tabular-nums}
.admin-security .security-list{list-style:none;padding:0;margin:0}
.admin-security .security-list>li+li{border-top:1px solid var(--line)}
.admin-security .security-check{display:grid;grid-template-columns:112px minmax(0,1fr);gap:16px;align-items:start;padding:16px 0}
.admin-security .security-check:first-child{padding-top:0}
.admin-security .security-check:last-child{padding-bottom:0}
.admin-security .security-check p{margin-top:4px}
.admin-security .security-pill{display:inline-flex;justify-self:start;align-items:center;padding:3px 8px;max-width:100%;border:1px solid color-mix(in srgb,var(--security-tone) 40%,var(--line));border-radius:6px;background:color-mix(in srgb,var(--security-tone) 8%,var(--surface));color:var(--text);font-size:12px;font-weight:600;line-height:1.5}
.admin-security .security-control{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:24px 0;border-top:1px solid var(--line)}
.admin-security .security-control:last-child{padding-bottom:0}
.admin-security .security-control>div{min-width:0;flex:1}
.admin-security .security-control>div>p{margin-top:8px}
.admin-security .security-control>.btn{flex:0 1 320px}
.admin-security .btn{min-height:44px;max-width:100%;white-space:normal;text-align:center;overflow-wrap:anywhere;transition:none}
.admin-security .btn:focus-visible,.admin-security a:focus-visible,.admin-security [tabindex='-1']:focus-visible{outline:2px solid var(--accent);outline-offset:4px}
.admin-security .btn.danger{color:var(--text);border-color:color-mix(in srgb,var(--bad) 60%,var(--line2));background:color-mix(in srgb,var(--bad) 7%,var(--surface))}
.admin-security .btn.danger:hover{background:color-mix(in srgb,var(--bad) 14%,var(--surface))}
.admin-security .btn:disabled{opacity:.55;cursor:wait}
.admin-security .security-filters{gap:8px;margin-bottom:16px}
.admin-security .security-filters [aria-pressed=true]{background:var(--soft);border-color:var(--accent);color:var(--text)}
.admin-security #security-session-count{font-variant-numeric:tabular-nums;margin-bottom:8px}
.admin-security #security-users-note:empty{display:none}
.admin-security .security-session{display:grid;grid-template-columns:minmax(180px,1fr) minmax(0,1.5fr);gap:16px 24px;padding:24px 0}
.admin-security .security-session:last-child{padding-bottom:0}
.admin-security .security-identity{display:flex;align-items:flex-start;gap:16px;min-width:0}
.admin-security .security-identity>div{min-width:0}
.admin-security .security-identity p{margin-top:4px}
.admin-security .avatar{width:40px;height:40px;flex:none}
.admin-security .security-name{display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-width:0}
.admin-security .security-dates{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:0;font-size:13px;font-variant-numeric:tabular-nums}
.admin-security .security-dates dt{color:var(--text2);margin-bottom:8px}
.admin-security .security-dates dd{margin:0;line-height:1.6}
.admin-security .security-session-actions{grid-column:1/-1;gap:8px;justify-content:flex-end}
.admin-security .security-session-actions>p{margin-right:auto}
.admin-security .security-empty{padding:24px 0}
.admin-security .security-account{display:flex;align-items:center;gap:16px;padding:16px 0}
.admin-security .security-account>strong{flex:1;min-width:0}
.admin-security .security-account:first-child{padding-top:0}
.admin-security .security-account:last-child{padding-bottom:0}
.admin-security .security-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.admin-security .security-stat{display:flex;flex-direction:column;gap:8px;padding:16px;background:var(--side);border:1px solid var(--line);border-radius:8px;text-decoration:none;color:var(--text)}
.admin-security .security-stat strong{font-size:24px;line-height:1.2;font-variant-numeric:tabular-nums}
.admin-security .security-stat span{font-size:13px;color:var(--text2)}
.admin-security .security-stat:hover{border-color:var(--line2);background:var(--soft)}
.admin-security .security-key{display:flex;justify-content:space-between;gap:16px;padding:16px 0}
.admin-security .security-key:first-child{padding-top:0}
.admin-security .security-link{margin-top:16px}
.admin-security .security-timeline>li{position:relative;display:grid;grid-template-columns:136px minmax(0,1fr);gap:24px;padding:16px 0 16px 20px}
.admin-security .security-timeline>li:before{content:'';position:absolute;left:0;top:23px;width:6px;height:6px;background:var(--text3);border-radius:50%}
.admin-security .security-timeline time{font-size:12px;color:var(--text2);font-variant-numeric:tabular-nums}
.admin-security .security-timeline strong{font-size:14px;font-weight:500}
.admin-security .security-timeline p{margin-top:4px}
.admin-security .security-footnote{background:var(--side)}
.admin-security .security-footnote ul{padding-left:20px;margin:0;display:grid;gap:8px;color:var(--text2);font-size:13px}
.admin-security .security-footnote code{font-size:inherit;white-space:normal}
.admin-security .security-notice:empty{display:none}
.admin-security .security-notice:not(:empty){padding:16px;border:1px solid var(--line2);border-radius:8px;background:var(--side)}
.admin-security .security-error{border-left:4px solid var(--bad);margin-bottom:24px;display:grid;gap:16px;justify-items:start}
.admin-security .security-skeleton{display:grid;gap:24px}
.admin-security .security-skeleton>div{display:grid;grid-template-columns:112px minmax(0,1fr);gap:16px}
.admin-security .security-skeleton i{display:block;height:16px;background:var(--line);border-radius:4px}
.admin-security .security-skeleton>i:first-child{height:32px;width:55%}
@media(max-width:900px){
 .admin-security .security-session{grid-template-columns:minmax(0,1fr)}
 .admin-security .security-stats{grid-template-columns:repeat(3,minmax(0,1fr))}
 .admin-security .security-control{align-items:flex-start;flex-direction:column;gap:16px}
 .admin-security .security-control>.btn{flex:auto}
}
@media(max-width:540px){
 .admin-security .pad{padding:16px}
 .admin-security #security-root,.admin-security #security-loading{gap:16px}
 .admin-security .security-summary{align-items:stretch;flex-direction:column;gap:16px}
 .admin-security .security-refresh{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}
 .admin-security #security-posture{font-size:24px}
 .admin-security .security-check{grid-template-columns:minmax(0,1fr);gap:8px}
 .admin-security .security-dates{grid-template-columns:minmax(0,1fr);gap:8px}
 .admin-security .security-dates>div{display:grid;grid-template-columns:80px minmax(0,1fr);gap:8px}
 .admin-security .security-dates dt{margin:0}
 .admin-security .security-session-actions>.btn,.admin-security .security-control>.btn{width:100%;flex:auto}
 .admin-security .security-account{flex-wrap:wrap;gap:8px}
 .admin-security .security-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
 .admin-security .security-key{flex-direction:column;gap:8px}
 .admin-security .security-timeline>li{grid-template-columns:minmax(0,1fr);gap:8px}
 .admin-security .security-skeleton>div{grid-template-columns:64px minmax(0,1fr)}
}
@media(prefers-reduced-motion:no-preference){
 .admin-security .btn,.admin-security .security-stat{transition:background-color .15s ease,border-color .15s ease}
}

.audit-tools{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px}.audit-tools label{flex:1 1 280px;max-width:420px}.audit-filters{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px}.audit-filters .btn{min-height:36px;padding:6px 14px;border-radius:999px;font-size:14px}.audit-filters .btn[aria-pressed=true]{background:var(--accent);color:var(--ink);border-color:transparent;font-weight:600}
.audit-day{margin-bottom:20px}.audit-day>h2{font-size:13px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px}
.audit-row{display:grid;grid-template-columns:10px 56px 140px minmax(0,1fr);gap:12px;align-items:start;padding:12px 16px;border-top:1px solid var(--line)}.audit-row:first-child{border-top:0}
.audit-sev{width:8px;height:8px;border-radius:50%;margin-top:7px;background:var(--idle)}.audit-sev[data-sev=warn]{background:var(--warn)}.audit-sev[data-sev=bad]{background:#e5484d}
.audit-time{color:var(--text2);font-size:13px;padding-top:2px}.audit-who{font-weight:500;overflow-wrap:anywhere}
.audit-head{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline}.audit-head b{font-weight:600;font-size:15px}.audit-target{color:var(--text2)}
.audit-sentence{margin:4px 0 0;font-size:14px;line-height:1.45;color:var(--text2);overflow-wrap:anywhere}
.audit-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.audit-chips span{padding:3px 10px;border:1px solid var(--line2);border-radius:999px;font-size:13px;color:var(--text2);overflow-wrap:anywhere}
.audit-raw{display:block;margin-top:4px;font-size:11.5px;overflow-wrap:anywhere}
@media(max-width:700px){.audit-row{grid-template-columns:10px 1fr;gap:4px 10px}.audit-time{grid-column:2}.audit-who{grid-column:2}.audit-what{grid-column:2}}

/* Compact layout: two columns beside the nav on wide screens, tighter spacing, long lists scroll inside their card. */
.admin-security .sec-cols{display:flex;flex-direction:column;gap:14px}.admin-security .sec-cols>.col{display:flex;flex-direction:column;gap:14px;min-width:0}
@media(min-width:1100px){.admin-security .sec-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.admin-security{max-width:1400px}}
.admin-security #security-root,.admin-security #security-loading{gap:14px}
.admin-security .pad{padding:16px 18px}
.admin-security .security-heading{gap:2px;margin-bottom:8px}
.admin-security h2{font-size:16px}
.admin-security .security-check{padding:9px 0;gap:12px}
.admin-security .security-session{padding:12px 0}
.admin-security #security-sessions,.admin-security #security-events{max-height:380px;overflow:auto;padding-right:6px}
.admin-security #security-checks{max-height:460px;overflow:auto;padding-right:6px}
`;
