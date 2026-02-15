import{j as e}from"./jsx-runtime-u17CrQMm.js";import{a2 as r,a5 as o}from"./media-status-badge-DETbNkVM.js";import"./badge-B6bn15vN.js";import"./slot-CUYGZ4Fv.js";import"./utils-CDN07tui.js";import"./app-BHuVDAkc.js";import"./button-B9kPMW4q.js";import"./spinner-McTJFRVv.js";import"./createLucideIcon-GXN1tXoc.js";import"./useRenderElement-D0Q1kVud.js";import"./useBaseUiId-BvJSLVy2.js";import"./index-D5-0xbEa.js";import"./index-CYxWbFTv.js";import"./useValueAsRef-GoV-SdOe.js";import"./index.min-fvaCWwiU.js";const{action:a}=__STORYBOOK_MODULE_ACTIONS__,U={component:r,tags:["autodocs"],args:{onToggleRequest:a("onToggleRequest")},decorators:[s=>e.jsx("div",{style:{padding:"2rem"},children:e.jsx(s,{})})]},n={args:{status:"none"}},t={name:"None (showRequestButton=false)",args:{status:"none",showRequestButton:!1}},d={args:{status:"requested"}},g={args:{status:"downloading",progress:42}},i={name:"Downloading (97%)",args:{status:"downloading",progress:97.3}},u={args:{status:"importing"}},m={args:{status:"downloaded"}},l={name:"Toggling (from none)",args:{status:"none",isToggling:!0}},c={name:"Toggling (from requested)",args:{status:"requested",isToggling:!0}},p={name:"Small - Downloaded",args:{status:"downloaded",size:"sm"}},T={name:"Small - Requested",args:{status:"requested",size:"sm"}},q={name:"Small - None",args:{status:"none",size:"sm"}},S={name:"Tiny - Downloaded",args:{status:"downloaded",size:"tiny"}},w={name:"Tiny - Requested",args:{status:"requested",size:"tiny"}},y={name:"Tiny - None",args:{status:"none",size:"tiny"}},R={name:"Tiny - Downloading",args:{status:"downloading",progress:65,size:"tiny"}},x={name:"All Statuses",render:s=>e.jsxs("div",{style:{display:"flex",gap:"0.75rem",alignItems:"center",flexWrap:"wrap"},children:[e.jsx(r,{...s,status:"none"}),e.jsx(r,{...s,status:"requested"}),e.jsx(r,{...s,status:"downloading",progress:55}),e.jsx(r,{...s,status:"importing"}),e.jsx(r,{...s,status:"downloaded"})]}),args:{}};a("onToggleRequest");const v={name:"Card - None",render:s=>e.jsx("div",{className:"group",style:{padding:"2rem"},children:e.jsx(o,{...s})}),args:{status:"none",size:"sm",showOnHover:!1,onToggleRequest:a("onToggleRequest")}},N={name:"Card - None (hover to show)",render:s=>e.jsxs("div",{className:"group",style:{padding:"2rem",border:"1px dashed gray",borderRadius:"8px"},children:[e.jsx("p",{style:{fontSize:"12px",marginBottom:"8px",color:"gray"},children:"Hover this area to reveal the button"}),e.jsx(o,{...s})]}),args:{status:"none",size:"sm",showOnHover:!0,onToggleRequest:a("onToggleRequest")}},C={name:"Card - Requested",render:s=>e.jsx("div",{style:{padding:"2rem"},children:e.jsx(o,{...s})}),args:{status:"requested",size:"sm",onToggleRequest:a("onToggleRequest")}},h={name:"Card - Downloaded",render:s=>e.jsx("div",{style:{padding:"2rem"},children:e.jsx(o,{...s})}),args:{status:"downloaded",size:"sm",onToggleRequest:a("onToggleRequest")}},z={name:"Card - Toggling",render:s=>e.jsx("div",{style:{padding:"2rem"},children:e.jsx(o,{...s})}),args:{status:"none",size:"sm",isToggling:!0,onToggleRequest:a("onToggleRequest")}},D={name:"Card - Tiny None",render:s=>e.jsx("div",{className:"group",style:{padding:"2rem"},children:e.jsx(o,{...s})}),args:{status:"none",size:"tiny",onToggleRequest:a("onToggleRequest")}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    status: 'none'
  }
}`,...n.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  name: 'None (showRequestButton=false)',
  args: {
    status: 'none',
    showRequestButton: false
  }
}`,...t.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    status: 'requested'
  }
}`,...d.parameters?.docs?.source}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    status: 'downloading',
    progress: 42
  }
}`,...g.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  name: 'Downloading (97%)',
  args: {
    status: 'downloading',
    progress: 97.3
  }
}`,...i.parameters?.docs?.source}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    status: 'importing'
  }
}`,...u.parameters?.docs?.source}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    status: 'downloaded'
  }
}`,...m.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: 'Toggling (from none)',
  args: {
    status: 'none',
    isToggling: true
  }
}`,...l.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  name: 'Toggling (from requested)',
  args: {
    status: 'requested',
    isToggling: true
  }
}`,...c.parameters?.docs?.source}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: 'Small - Downloaded',
  args: {
    status: 'downloaded',
    size: 'sm'
  }
}`,...p.parameters?.docs?.source}}};T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  name: 'Small - Requested',
  args: {
    status: 'requested',
    size: 'sm'
  }
}`,...T.parameters?.docs?.source}}};q.parameters={...q.parameters,docs:{...q.parameters?.docs,source:{originalSource:`{
  name: 'Small - None',
  args: {
    status: 'none',
    size: 'sm'
  }
}`,...q.parameters?.docs?.source}}};S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  name: 'Tiny - Downloaded',
  args: {
    status: 'downloaded',
    size: 'tiny'
  }
}`,...S.parameters?.docs?.source}}};w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  name: 'Tiny - Requested',
  args: {
    status: 'requested',
    size: 'tiny'
  }
}`,...w.parameters?.docs?.source}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  name: 'Tiny - None',
  args: {
    status: 'none',
    size: 'tiny'
  }
}`,...y.parameters?.docs?.source}}};R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
  name: 'Tiny - Downloading',
  args: {
    status: 'downloading',
    progress: 65,
    size: 'tiny'
  }
}`,...R.parameters?.docs?.source}}};x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  name: 'All Statuses',
  render: args => <div style={{
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
    flexWrap: 'wrap'
  }}>
      <MediaStatusBadge {...args} status="none" />
      <MediaStatusBadge {...args} status="requested" />
      <MediaStatusBadge {...args} status="downloading" progress={55} />
      <MediaStatusBadge {...args} status="importing" />
      <MediaStatusBadge {...args} status="downloaded" />
    </div>,
  args: {}
}`,...x.parameters?.docs?.source}}};v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: 'Card - None',
  render: args => <div className="group" style={{
    padding: '2rem'
  }}>
      <CardStatusBadge {...args} />
    </div>,
  args: {
    status: 'none',
    size: 'sm',
    showOnHover: false,
    onToggleRequest: action('onToggleRequest')
  }
}`,...v.parameters?.docs?.source}}};N.parameters={...N.parameters,docs:{...N.parameters?.docs,source:{originalSource:`{
  name: 'Card - None (hover to show)',
  render: args => <div className="group" style={{
    padding: '2rem',
    border: '1px dashed gray',
    borderRadius: '8px'
  }}>
      <p style={{
      fontSize: '12px',
      marginBottom: '8px',
      color: 'gray'
    }}>
        Hover this area to reveal the button
      </p>
      <CardStatusBadge {...args} />
    </div>,
  args: {
    status: 'none',
    size: 'sm',
    showOnHover: true,
    onToggleRequest: action('onToggleRequest')
  }
}`,...N.parameters?.docs?.source}}};C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  name: 'Card - Requested',
  render: args => <div style={{
    padding: '2rem'
  }}>
      <CardStatusBadge {...args} />
    </div>,
  args: {
    status: 'requested',
    size: 'sm',
    onToggleRequest: action('onToggleRequest')
  }
}`,...C.parameters?.docs?.source}}};h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  name: 'Card - Downloaded',
  render: args => <div style={{
    padding: '2rem'
  }}>
      <CardStatusBadge {...args} />
    </div>,
  args: {
    status: 'downloaded',
    size: 'sm',
    onToggleRequest: action('onToggleRequest')
  }
}`,...h.parameters?.docs?.source}}};z.parameters={...z.parameters,docs:{...z.parameters?.docs,source:{originalSource:`{
  name: 'Card - Toggling',
  render: args => <div style={{
    padding: '2rem'
  }}>
      <CardStatusBadge {...args} />
    </div>,
  args: {
    status: 'none',
    size: 'sm',
    isToggling: true,
    onToggleRequest: action('onToggleRequest')
  }
}`,...z.parameters?.docs?.source}}};D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  name: 'Card - Tiny None',
  render: args => <div className="group" style={{
    padding: '2rem'
  }}>
      <CardStatusBadge {...args} />
    </div>,
  args: {
    status: 'none',
    size: 'tiny',
    onToggleRequest: action('onToggleRequest')
  }
}`,...D.parameters?.docs?.source}}};const Y=["None","NoneHidden","Requested","Downloading","DownloadingAlmostDone","Importing","Downloaded","TogglingFromNone","TogglingFromRequested","SmallDownloaded","SmallRequested","SmallNone","TinyDownloaded","TinyRequested","TinyNone","TinyDownloading","AllStatuses","CardNone","CardNoneShowOnHover","CardRequested","CardDownloaded","CardToggling","CardTiny"];export{x as AllStatuses,h as CardDownloaded,v as CardNone,N as CardNoneShowOnHover,C as CardRequested,D as CardTiny,z as CardToggling,m as Downloaded,g as Downloading,i as DownloadingAlmostDone,u as Importing,n as None,t as NoneHidden,d as Requested,p as SmallDownloaded,q as SmallNone,T as SmallRequested,S as TinyDownloaded,R as TinyDownloading,y as TinyNone,w as TinyRequested,l as TogglingFromNone,c as TogglingFromRequested,Y as __namedExportsOrder,U as default};
