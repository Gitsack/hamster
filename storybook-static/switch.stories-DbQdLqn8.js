import{j as e}from"./jsx-runtime-u17CrQMm.js";import{S as s}from"./switch-FMiJ_scT.js";import"./utils-CDN07tui.js";import"./app-BHuVDAkc.js";import"./useLabelableId-CyGgmgle.js";import"./useBaseUiId-BvJSLVy2.js";import"./useRenderElement-D0Q1kVud.js";import"./index-D5-0xbEa.js";import"./index-CYxWbFTv.js";const b={component:s,tags:["autodocs"],argTypes:{disabled:{control:"boolean"},defaultChecked:{control:"boolean"}}},t={},a={args:{defaultChecked:!0}},r={args:{disabled:!0}},n={args:{disabled:!0,defaultChecked:!0}},d={render:()=>e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(s,{id:"notifications"}),e.jsx("label",{htmlFor:"notifications",className:"text-sm font-medium",children:"Enable notifications"})]})},c={render:()=>e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-medium",children:"Auto-scan library"}),e.jsx("p",{className:"text-sm text-muted-foreground",children:"Automatically scan for new media files."})]}),e.jsx(s,{defaultChecked:!0})]}),e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-medium",children:"Download metadata"}),e.jsx("p",{className:"text-sm text-muted-foreground",children:"Fetch metadata from external sources."})]}),e.jsx(s,{defaultChecked:!0})]}),e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-medium",children:"Transcode media"}),e.jsx("p",{className:"text-sm text-muted-foreground",children:"Enable on-the-fly transcoding."})]}),e.jsx(s,{})]})]})};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:"{}",...t.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    defaultChecked: true
  }
}`,...a.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...r.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true,
    defaultChecked: true
  }
}`,...n.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <div className="flex items-center gap-2">
      <Switch id="notifications" />
      <label htmlFor="notifications" className="text-sm font-medium">
        Enable notifications
      </label>
    </div>
}`,...d.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: () => <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Auto-scan library</p>
          <p className="text-sm text-muted-foreground">Automatically scan for new media files.</p>
        </div>
        <Switch defaultChecked />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Download metadata</p>
          <p className="text-sm text-muted-foreground">Fetch metadata from external sources.</p>
        </div>
        <Switch defaultChecked />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Transcode media</p>
          <p className="text-sm text-muted-foreground">Enable on-the-fly transcoding.</p>
        </div>
        <Switch />
      </div>
    </div>
}`,...c.parameters?.docs?.source}}};const j=["Default","Checked","Disabled","DisabledChecked","WithLabel","FormExample"];export{a as Checked,t as Default,r as Disabled,n as DisabledChecked,c as FormExample,d as WithLabel,j as __namedExportsOrder,b as default};
