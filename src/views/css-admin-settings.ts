// Settings-only layout and controls; shared theme colours remain in css.ts.
export const adminSettingsCss = String.raw`
.admin-settings{max-width:1120px;min-width:0}
.admin-settings .settings-layout{width:100%;display:grid;gap:24px}
.admin-settings .settings-tabs{display:flex;gap:8px;border-bottom:1px solid var(--line2);overflow-x:auto;padding:0 0 8px}
.admin-settings .settings-tabs [role=tab]{flex:none;min-height:48px;padding:8px 16px;border:0;border-bottom:3px solid transparent;border-radius:6px 6px 0 0;background:transparent;color:var(--text2);font-weight:500;cursor:pointer}
.admin-settings .settings-tabs [role=tab]:hover{background:var(--line);color:var(--text)}
.admin-settings .settings-tabs [aria-selected=true]{border-bottom-color:var(--accent);background:var(--soft);color:var(--accent)}
.admin-settings .settings-section{min-width:0;gap:24px}
.admin-settings .section-heading{display:grid;gap:8px}
.admin-settings .section-heading h2{font-size:20px}
.admin-settings .top{gap:16px;margin:0}
.admin-settings .top>h2,.admin-settings .top>h3{flex:1}
.admin-settings .stack{gap:16px}
.admin-settings .settings-section.stack{gap:24px}
.admin-settings .pad{padding:24px}
.admin-settings .settings-note{padding:16px;border-left:3px solid var(--line2);background:var(--surface);border-radius:0 6px 6px 0}
.admin-settings .card{border-color:var(--line2)}
.admin-settings .actions{gap:8px;justify-content:flex-end}
.admin-settings .actions>*{flex:0 1 auto}
.admin-settings .btn{min-height:44px;padding:8px 16px}
.admin-settings .actions>.danger{margin-left:16px;border-color:var(--bad)}
.admin-settings .settings-footer{border-top:1px solid var(--line);padding-top:24px;margin-top:8px}
.admin-settings .field{display:block;margin-top:8px;padding:8px 16px;min-height:48px;background:var(--bg);border:1px solid var(--line2);border-radius:6px;color:var(--text)}
.admin-settings .field::placeholder{color:var(--text2);opacity:1}
.admin-settings textarea.field{resize:vertical;line-height:1.6}
.admin-settings label{font-weight:500;min-width:0}
.admin-settings small{display:block;margin-top:8px;color:var(--text2);font-size:13px;font-weight:400}
.admin-settings .check-label,.admin-settings #preset-libraries label{display:flex;gap:8px;align-items:center;min-height:44px;font-weight:400}
.admin-settings input[type=checkbox]{flex-shrink:0;accent-color:var(--accent)}
.admin-settings :is(button,input,select,textarea,summary,[tabindex]):focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.admin-settings .settings-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:24px}
.admin-settings .settings-fields>.check-label{align-self:center}
.admin-settings fieldset{min-width:0;border:1px solid var(--line2);border-radius:8px;padding:16px;gap:16px}
.admin-settings legend{padding:0 8px;font-weight:600}
.admin-settings #preset-libraries{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:8px;background:var(--bg)}
.admin-settings #preset-libraries:disabled{color:var(--text2);opacity:.65}
.admin-settings .settings-editor{border-top:3px solid var(--accent)}
.admin-settings .preset-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:24px;padding:16px}
.admin-settings .preset-summary{min-width:0;display:grid;gap:8px}
.admin-settings .preset-summary p{font-size:13px}
.admin-settings .preset-row>.actions{max-width:440px}
.admin-settings .connection-checks{gap:8px}
.admin-settings .connection-status{border:1px solid var(--line2);border-radius:999px;padding:4px 8px;color:var(--text2);font-size:12px;max-width:280px;overflow-wrap:anywhere}
.admin-settings .connection-status[data-state=ok]{color:var(--ok);border-color:var(--ok)}
.admin-settings .connection-status[data-state=bad]{color:var(--bad);border-color:var(--bad)}
.admin-settings .connection-status[data-state=checking]{color:var(--warn);border-color:var(--warn)}
.admin-settings .key-editor{border:1px solid var(--line);border-radius:8px;padding:0 16px;background:var(--bg)}
.admin-settings .key-editor summary{padding:16px 0;min-height:48px;font-size:14px}
.admin-settings .key-editor[open]{padding-bottom:16px}
.admin-settings .key-editor>p{margin-top:0}
.admin-settings .key-editor>label,.admin-settings .key-editor>.actions{margin-top:16px}
.admin-settings .key-editor .field{background:var(--surface)}
.admin-settings .key-editor>.actions{border-top:1px solid var(--line);padding-top:16px}
.admin-settings .key-editor>.actions>.pri{order:1}
.admin-settings .key-editor>.actions>.danger{margin-left:0;margin-right:auto}
.admin-settings .switch-row{display:flex;align-items:center;justify-content:space-between;gap:24px}
.admin-settings .switch-row p{margin-top:8px}
.admin-settings #messages-list .service{padding:16px 0;border-top:1px solid var(--line);border-bottom:0;gap:8px}
.admin-settings #messages-list .service>.btn{align-self:flex-end}
.admin-settings #messages-list .service>p{white-space:pre-wrap}
.admin-settings .import-step+.import-step{border-top:1px solid var(--line);padding-top:24px;margin-top:8px}
.admin-settings .import-step h3{display:flex;align-items:center;gap:8px}
.admin-settings .step-number{display:inline-grid;place-items:center;flex:none;width:32px;height:32px;border:1px solid var(--line2);border-radius:50%;color:var(--text2);font-size:13px;font-variant-numeric:tabular-nums}
.admin-settings #import-json{font-family:ui-monospace,SFMono-Regular,monospace;font-size:13px}
.admin-settings .settings-result{padding:16px;border:1px solid var(--line2);border-radius:8px;background:var(--bg);overflow-wrap:anywhere}
.admin-settings .import-confirm{border-left:3px solid var(--bad);padding-left:16px}
.admin-settings .import-confirm .danger{margin-left:0}
@media(max-width:1000px){
 .admin-settings .preset-row{grid-template-columns:minmax(0,1fr);gap:16px}
 .admin-settings .preset-row>.actions{max-width:none}
}
@media(max-width:700px){
 .admin-settings .pad{padding:16px}
 .admin-settings .settings-fields,.admin-settings #preset-libraries{grid-template-columns:minmax(0,1fr);gap:16px}
 .admin-settings .settings-tabs [role=tab]{padding:8px}
 .admin-settings .field,.admin-settings #import-json{font-size:16px}
 .admin-settings .connection-card>.top{align-items:flex-start;flex-direction:column}
 .admin-settings .connection-checks{width:100%;justify-content:space-between}
 .admin-settings .actions{gap:8px}
 .admin-settings .preset-row .actions>.danger{margin-left:8px}
}
@media(forced-colors:active){
   .admin-settings .settings-tabs [aria-selected=true]{border-bottom-color:Highlight}
}
.maint-confirm{border:1px solid var(--warn);background:color-mix(in srgb,var(--warn) 10%,var(--surface));border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:12px}.maint-confirm[hidden]{display:none}
.guide-steps{margin:8px 0 4px 20px;display:flex;flex-direction:column;gap:6px;color:var(--text2)}
.test-result{margin:0;overflow-wrap:anywhere;white-space:pre-line;color:var(--text2)}.test-result:empty{display:none}.test-result[data-state=ok]{color:var(--accent)}.test-result[data-state=bad]{color:var(--bad)}
.sh-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr));align-items:start}.field-row{display:grid;gap:12px;grid-template-columns:minmax(0,3fr) minmax(0,2fr)}@media(max-width:560px){.field-row{grid-template-columns:minmax(0,1fr)}}.connection-status[data-state=off]{color:var(--text3)}
html[data-email=off] .needs-email{display:none!important}
.update-banner{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 16px;margin:0 0 16px;border:1px solid var(--accent);border-radius:10px;background:color-mix(in srgb,var(--accent) 10%,var(--surface))}.update-banner a{color:var(--accent);font-weight:600}.update-banner .btn{margin-left:auto}.update-line{font-weight:600}.changelog-body{overflow-wrap:anywhere;margin:8px 0 0;color:var(--text2);max-height:260px;overflow:auto}.changelog-body h5{margin:10px 0 4px;font-size:13px;color:var(--text)}.changelog-body ul{margin:4px 0 8px 18px}.changelog-body p{margin:4px 0}.changelog h4{margin:6px 0 0;font-size:14px}
`;
