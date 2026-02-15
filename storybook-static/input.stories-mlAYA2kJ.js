import{j as p}from"./jsx-runtime-u17CrQMm.js";import{I as d}from"./input-Bw95PIWX.js";import"./utils-CDN07tui.js";const h={component:d,tags:["autodocs"],argTypes:{type:{control:"select",options:["text","password","email","number","search","url","tel","file"]},disabled:{control:"boolean"},placeholder:{control:"text"}}},e={args:{placeholder:"Enter text..."}},a={args:{defaultValue:"Hello, world!"}},r={args:{type:"password",placeholder:"Enter password..."}},s={args:{type:"email",placeholder:"name@example.com"}},o={args:{type:"number",placeholder:"0"}},l={args:{type:"search",placeholder:"Search..."}},t={args:{type:"file"}},c={args:{placeholder:"Disabled input",disabled:!0}},n={render:()=>p.jsxs("div",{className:"grid w-full max-w-sm gap-1.5",children:[p.jsx("label",{htmlFor:"email",className:"text-sm font-medium",children:"Email"}),p.jsx(d,{type:"email",id:"email",placeholder:"name@example.com"})]})},m={args:{"aria-invalid":!0,defaultValue:"invalid value"}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  args: {
    placeholder: 'Enter text...'
  }
}`,...e.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    defaultValue: 'Hello, world!'
  }
}`,...a.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'password',
    placeholder: 'Enter password...'
  }
}`,...r.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'email',
    placeholder: 'name@example.com'
  }
}`,...s.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'number',
    placeholder: '0'
  }
}`,...o.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'search',
    placeholder: 'Search...'
  }
}`,...l.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    type: 'file'
  }
}`,...t.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    placeholder: 'Disabled input',
    disabled: true
  }
}`,...c.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: () => <div className="grid w-full max-w-sm gap-1.5">
      <label htmlFor="email" className="text-sm font-medium">
        Email
      </label>
      <Input type="email" id="email" placeholder="name@example.com" />
    </div>
}`,...n.parameters?.docs?.source}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    'aria-invalid': true,
    defaultValue: 'invalid value'
  }
}`,...m.parameters?.docs?.source}}};const x=["Default","WithValue","Password","Email","Number","Search","File","Disabled","WithLabel","Invalid"];export{e as Default,c as Disabled,s as Email,t as File,m as Invalid,o as Number,r as Password,l as Search,n as WithLabel,a as WithValue,x as __namedExportsOrder,h as default};
