const CopyInfoIcon = ({ className = '', strokeWidth = 1.5, copied = false }) => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={`icon icon-tabler icons-tabler-outline ${copied ? 'icon-tabler-copy-check' : 'icon-tabler-copy'} ${className}`} height={18} strokeWidth={strokeWidth} width={18} viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/>{copied ? (<><path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666"/><path d="M4.012 16.737a2 2 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"/><path d="M11 14l2 2l4 -4"/></>) : (<><path d="M7 9.667A2.667 2.667 0 0 1 9.667 7h8.666A2.667 2.667 0 0 1 21 9.667v8.666A2.667 2.667 0 0 1 18.333 21H9.667A2.667 2.667 0 0 1 7 18.333z"/><path d="M4.012 16.737A2 2 0 0 1 3 15V5c0-1.1.9-2 2-2h10c.75 0 1.158.385 1.5 1"/></>)}</svg>
    );
};

export default CopyInfoIcon;