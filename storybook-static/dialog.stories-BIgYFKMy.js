import{j as e}from"./jsx-runtime-u17CrQMm.js";import{D as o,f as m,a as i,b as a,c as t,d as l,e as D,g as u}from"./dialog-CQTA4pg1.js";import{B as n}from"./button-B9kPMW4q.js";import{I as h}from"./input-Bw95PIWX.js";import"./app-BHuVDAkc.js";import"./index-D5-0xbEa.js";import"./index-CYxWbFTv.js";import"./utils-CDN07tui.js";import"./createLucideIcon-GXN1tXoc.js";import"./slot-CUYGZ4Fv.js";const F={component:o,tags:["autodocs"]},r={render:()=>e.jsxs(o,{children:[e.jsx(m,{children:e.jsx(n,{children:"Open Dialog"})}),e.jsxs(i,{children:[e.jsxs(a,{children:[e.jsx(t,{children:"Dialog Title"}),e.jsx(l,{children:"This is a description of the dialog. It provides additional context."})]}),e.jsxs(D,{children:[e.jsx(u,{children:e.jsx(n,{variant:"outline",children:"Cancel"})}),e.jsx(n,{children:"Confirm"})]})]})]})},s={render:()=>e.jsx(o,{defaultOpen:!0,children:e.jsx(i,{children:e.jsxs(a,{children:[e.jsx(t,{children:"Default Open Dialog"}),e.jsx(l,{children:"This dialog opens by default."})]})})})},d={render:()=>e.jsxs(o,{children:[e.jsx(m,{children:e.jsx(n,{children:"Edit Profile"})}),e.jsxs(i,{children:[e.jsxs(a,{children:[e.jsx(t,{children:"Edit Profile"}),e.jsx(l,{children:"Make changes to your profile here."})]}),e.jsxs("div",{className:"grid gap-4 py-4",children:[e.jsxs("div",{className:"grid gap-1.5",children:[e.jsx("label",{htmlFor:"name",className:"text-sm font-medium",children:"Name"}),e.jsx(h,{id:"name",defaultValue:"John Doe"})]}),e.jsxs("div",{className:"grid gap-1.5",children:[e.jsx("label",{htmlFor:"email",className:"text-sm font-medium",children:"Email"}),e.jsx(h,{id:"email",type:"email",defaultValue:"john@example.com"})]})]}),e.jsxs(D,{children:[e.jsx(u,{children:e.jsx(n,{variant:"outline",children:"Cancel"})}),e.jsx(n,{children:"Save Changes"})]})]})]})},c={render:()=>e.jsxs(o,{children:[e.jsx(m,{children:e.jsx(n,{variant:"destructive",children:"Delete Item"})}),e.jsxs(i,{children:[e.jsxs(a,{children:[e.jsx(t,{children:"Are you sure?"}),e.jsx(l,{children:"This action cannot be undone. This will permanently delete the item from your library."})]}),e.jsxs(D,{children:[e.jsx(u,{children:e.jsx(n,{variant:"outline",children:"Cancel"})}),e.jsx(n,{variant:"destructive",children:"Delete"})]})]})]})},g={render:()=>e.jsx(o,{defaultOpen:!0,children:e.jsxs(i,{showCloseButton:!1,children:[e.jsxs(a,{children:[e.jsx(t,{children:"No Close Button"}),e.jsx(l,{children:"This dialog does not show the close button in the top-right corner."})]}),e.jsx(D,{children:e.jsx(u,{children:e.jsx(n,{variant:"outline",children:"Close"})})})]})})};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  render: () => <Dialog>
      <DialogTrigger>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>
            This is a description of the dialog. It provides additional context.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
}`,...r.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  render: () => <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Default Open Dialog</DialogTitle>
          <DialogDescription>This dialog opens by default.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
}`,...s.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <Dialog>
      <DialogTrigger>
        <Button>Edit Profile</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Make changes to your profile here.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-1.5">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <Input id="name" defaultValue="John Doe" />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input id="email" type="email" defaultValue="john@example.com" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
}`,...d.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: () => <Dialog>
      <DialogTrigger>
        <Button variant="destructive">Delete Item</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the item from your library.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
}`,...c.parameters?.docs?.source}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  render: () => <Dialog defaultOpen>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>No Close Button</DialogTitle>
          <DialogDescription>
            This dialog does not show the close button in the top-right corner.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
}`,...g.parameters?.docs?.source}}};const N=["Default","Open","WithForm","DestructiveAction","WithoutCloseButton"];export{r as Default,c as DestructiveAction,s as Open,d as WithForm,g as WithoutCloseButton,N as __namedExportsOrder,F as default};
