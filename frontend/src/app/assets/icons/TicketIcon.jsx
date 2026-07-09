const TicketIcon = ({className= "", strokeWidth = 2}) => {
    return (
       <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={className} height={24} strokeWidth={strokeWidth} width={24} viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M15 5v2m0 4v2m0 4v2M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2"/></svg>);
};

export default TicketIcon;