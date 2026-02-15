import{j as e}from"./jsx-runtime-u17CrQMm.js";import{r as f}from"./app-BHuVDAkc.js";import{H as S,i as I,z as w,I as j,j as F,e as A}from"./index.min-fvaCWwiU.js";const B={music:A,movies:F,tv:j,books:w,album:I};function g({src:a,alt:h,mediaType:v,className:b="",iconClassName:k="h-16 w-16"}){const[y,x]=f.useState(!1),T=B[v];return!a||y?e.jsx("div",{className:`w-full h-full flex items-center justify-center ${b}`,children:e.jsx(S,{icon:T,className:`text-muted-foreground/50 ${k}`})}):e.jsx("img",{src:a,alt:h,className:`w-full h-full object-cover ${b}`,loading:"lazy",onError:()=>x(!0)})}g.__docgenInfo={description:"",methods:[],displayName:"MediaImage",props:{src:{required:!0,tsType:{name:"union",raw:"string | null | undefined",elements:[{name:"string"},{name:"null"},{name:"undefined"}]},description:""},alt:{required:!0,tsType:{name:"string"},description:""},mediaType:{required:!0,tsType:{name:"union",raw:"'music' | 'movies' | 'tv' | 'books' | 'album'",elements:[{name:"literal",value:"'music'"},{name:"literal",value:"'movies'"},{name:"literal",value:"'tv'"},{name:"literal",value:"'books'"},{name:"literal",value:"'album'"}]},description:""},className:{required:!1,tsType:{name:"string"},description:"",defaultValue:{value:"''",computed:!1}},iconClassName:{required:!1,tsType:{name:"string"},description:"",defaultValue:{value:"'h-16 w-16'",computed:!1}}}};const N={component:g,tags:["autodocs"],decorators:[a=>e.jsx("div",{style:{width:"200px",height:"300px",borderRadius:"8px",overflow:"hidden"},children:e.jsx(a,{})})]},r={args:{src:"https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg",alt:"Fight Club",mediaType:"movies"}},s={name:"TV Show With Image",args:{src:"https://image.tmdb.org/t/p/w300/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",alt:"Breaking Bad",mediaType:"tv"}},n={args:{src:"https://coverartarchive.org/release/76df3287-6cda-33eb-8e9a-044b5e15c37c/829521842-250.jpg",alt:"Album Art",mediaType:"album"}},o={name:"Movie Fallback (null src)",args:{src:null,alt:"Unknown Movie",mediaType:"movies"}},l={name:"TV Fallback (null src)",args:{src:null,alt:"Unknown TV Show",mediaType:"tv"}},t={name:"Music Fallback (null src)",args:{src:null,alt:"Unknown Artist",mediaType:"music"}},c={name:"Books Fallback (null src)",args:{src:null,alt:"Unknown Book",mediaType:"books"}},m={name:"Album Fallback (null src)",args:{src:null,alt:"Unknown Album",mediaType:"album"}},i={name:"Broken Image (error fallback)",args:{src:"https://example.com/this-image-does-not-exist.jpg",alt:"Broken Image Test",mediaType:"movies"}},d={name:"Custom Icon Size",args:{src:null,alt:"Large Icon",mediaType:"music",iconClassName:"h-24 w-24"}},p={name:"Small Icon Size",decorators:[a=>e.jsx("div",{style:{width:"80px",height:"80px",borderRadius:"8px",overflow:"hidden",background:"var(--muted, #f3f4f6)"},children:e.jsx(a,{})})],args:{src:null,alt:"Small Icon",mediaType:"tv",iconClassName:"h-8 w-8"}},u={name:"All Media Type Fallbacks",decorators:[a=>e.jsx("div",{style:{display:"flex",gap:"1rem"},children:e.jsx(a,{})})],render:()=>e.jsx(e.Fragment,{children:["music","movies","tv","books","album"].map(a=>e.jsxs("div",{style:{width:"100px",height:"100px",borderRadius:"8px",overflow:"hidden",border:"1px solid #e5e7eb"},children:[e.jsx(g,{src:null,alt:a,mediaType:a,iconClassName:"h-10 w-10"}),e.jsx("p",{style:{textAlign:"center",fontSize:"11px",marginTop:"4px"},children:a})]},a))})};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    src: 'https://image.tmdb.org/t/p/w300/pB8BM7pdSp6B6Ih7QI4S2t0POvS.jpg',
    alt: 'Fight Club',
    mediaType: 'movies'
  }
}`,...r.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  name: 'TV Show With Image',
  args: {
    src: 'https://image.tmdb.org/t/p/w300/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
    alt: 'Breaking Bad',
    mediaType: 'tv'
  }
}`,...s.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    src: 'https://coverartarchive.org/release/76df3287-6cda-33eb-8e9a-044b5e15c37c/829521842-250.jpg',
    alt: 'Album Art',
    mediaType: 'album'
  }
}`,...n.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  name: 'Movie Fallback (null src)',
  args: {
    src: null,
    alt: 'Unknown Movie',
    mediaType: 'movies'
  }
}`,...o.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: 'TV Fallback (null src)',
  args: {
    src: null,
    alt: 'Unknown TV Show',
    mediaType: 'tv'
  }
}`,...l.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  name: 'Music Fallback (null src)',
  args: {
    src: null,
    alt: 'Unknown Artist',
    mediaType: 'music'
  }
}`,...t.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  name: 'Books Fallback (null src)',
  args: {
    src: null,
    alt: 'Unknown Book',
    mediaType: 'books'
  }
}`,...c.parameters?.docs?.source}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  name: 'Album Fallback (null src)',
  args: {
    src: null,
    alt: 'Unknown Album',
    mediaType: 'album'
  }
}`,...m.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  name: 'Broken Image (error fallback)',
  args: {
    src: 'https://example.com/this-image-does-not-exist.jpg',
    alt: 'Broken Image Test',
    mediaType: 'movies'
  }
}`,...i.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: 'Custom Icon Size',
  args: {
    src: null,
    alt: 'Large Icon',
    mediaType: 'music',
    iconClassName: 'h-24 w-24'
  }
}`,...d.parameters?.docs?.source}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: 'Small Icon Size',
  decorators: [Story => <div style={{
    width: '80px',
    height: '80px',
    borderRadius: '8px',
    overflow: 'hidden',
    background: 'var(--muted, #f3f4f6)'
  }}>
        <Story />
      </div>],
  args: {
    src: null,
    alt: 'Small Icon',
    mediaType: 'tv',
    iconClassName: 'h-8 w-8'
  }
}`,...p.parameters?.docs?.source}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: 'All Media Type Fallbacks',
  decorators: [Story => <div style={{
    display: 'flex',
    gap: '1rem'
  }}>
        <Story />
      </div>],
  render: () => <>
      {(['music', 'movies', 'tv', 'books', 'album'] as const).map(type => <div key={type} style={{
      width: '100px',
      height: '100px',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid #e5e7eb'
    }}>
          <MediaImage src={null} alt={type} mediaType={type} iconClassName="h-10 w-10" />
          <p style={{
        textAlign: 'center',
        fontSize: '11px',
        marginTop: '4px'
      }}>{type}</p>
        </div>)}
    </>
}`,...u.parameters?.docs?.source}}};const U=["MovieWithImage","TvWithImage","AlbumWithImage","MovieFallback","TvFallback","MusicFallback","BooksFallback","AlbumFallback","BrokenImage","CustomIconSize","SmallIconSize","AllFallbacks"];export{m as AlbumFallback,n as AlbumWithImage,u as AllFallbacks,c as BooksFallback,i as BrokenImage,d as CustomIconSize,o as MovieFallback,r as MovieWithImage,t as MusicFallback,p as SmallIconSize,l as TvFallback,s as TvWithImage,U as __namedExportsOrder,N as default};
