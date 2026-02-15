import{j as e}from"./jsx-runtime-u17CrQMm.js";import{C as r,a as c,b as l,c as C,d as a,e as p,f as m}from"./card-BT9UEfea.js";import{B as n}from"./button-B9kPMW4q.js";import"./utils-CDN07tui.js";import"./slot-CUYGZ4Fv.js";import"./app-BHuVDAkc.js";const g={component:r,tags:["autodocs"]},s={render:()=>e.jsxs(r,{className:"w-[380px]",children:[e.jsxs(c,{children:[e.jsx(l,{children:"Card Title"}),e.jsx(C,{children:"Card description goes here."})]}),e.jsx(a,{children:e.jsx("p",{children:"Card content goes here."})})]})},t={render:()=>e.jsxs(r,{className:"w-[380px]",children:[e.jsxs(c,{children:[e.jsx(l,{children:"Card Title"}),e.jsx(C,{children:"Card with a footer section."})]}),e.jsx(a,{children:e.jsx("p",{children:"Some content in the card body."})}),e.jsxs(p,{className:"gap-2",children:[e.jsx(n,{variant:"outline",children:"Cancel"}),e.jsx(n,{children:"Save"})]})]})},d={render:()=>e.jsxs(r,{className:"w-[380px]",children:[e.jsxs(c,{children:[e.jsx(l,{children:"Card Title"}),e.jsx(C,{children:"Card with an action button in the header."}),e.jsx(m,{children:e.jsx(n,{variant:"outline",size:"sm",children:"Action"})})]}),e.jsx(a,{children:e.jsx("p",{children:"Card content goes here."})})]})},o={render:()=>e.jsx(r,{className:"w-[380px]",children:e.jsx(a,{children:e.jsx("p",{children:"A card with only content, no header or footer."})})})},i={render:()=>e.jsxs(r,{className:"w-[380px]",children:[e.jsxs(c,{children:[e.jsx(l,{children:"Media Library"}),e.jsx(C,{children:"Manage your media collection settings."}),e.jsx(m,{children:e.jsx(n,{variant:"ghost",size:"sm",children:"Edit"})})]}),e.jsx(a,{children:e.jsxs("div",{className:"space-y-2 text-sm",children:[e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{className:"text-muted-foreground",children:"Movies"}),e.jsx("span",{children:"142"})]}),e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{className:"text-muted-foreground",children:"TV Shows"}),e.jsx("span",{children:"38"})]}),e.jsxs("div",{className:"flex justify-between",children:[e.jsx("span",{className:"text-muted-foreground",children:"Albums"}),e.jsx("span",{children:"256"})]})]})}),e.jsx(p,{children:e.jsx(n,{className:"w-full",children:"Scan Library"})})]})};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  render: () => <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content goes here.</p>
      </CardContent>
    </Card>
}`,...s.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: () => <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card with a footer section.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Some content in the card body.</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Save</Button>
      </CardFooter>
    </Card>
}`,...t.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card with an action button in the header.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm">
            Action
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p>Card content goes here.</p>
      </CardContent>
    </Card>
}`,...d.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: () => <Card className="w-[380px]">
      <CardContent>
        <p>A card with only content, no header or footer.</p>
      </CardContent>
    </Card>
}`,...o.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>Media Library</CardTitle>
        <CardDescription>Manage your media collection settings.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Movies</span>
            <span>142</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">TV Shows</span>
            <span>38</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Albums</span>
            <span>256</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Scan Library</Button>
      </CardFooter>
    </Card>
}`,...i.parameters?.docs?.source}}};const w=["Default","WithFooter","WithAction","ContentOnly","FullExample"];export{o as ContentOnly,s as Default,i as FullExample,d as WithAction,t as WithFooter,w as __namedExportsOrder,g as default};
