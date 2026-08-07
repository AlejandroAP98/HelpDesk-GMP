const BackIcon = ({ className = "", strokeWidth = 1.5 }) => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={`icon icon-tabler icons-tabler-outline icon-tabler-chevron-left ${className}`} height={24} strokeWidth={strokeWidth} width={24} viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z" /><path d="m15 6-6 6 6 6" /></svg>
    );
};

export default BackIcon;