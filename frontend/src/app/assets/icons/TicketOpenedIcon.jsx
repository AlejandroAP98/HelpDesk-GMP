const TicketOpenedIcon = ({ strokeWidth = 2, className = "" }) => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={`icon icon-tabler icons-tabler-outline icon-tabler-mail-opened ${className}`} height={24} strokeWidth={strokeWidth} width={24} viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z" /><path d="m3 9 9 6 9-6-9-6z" /><path d="M21 9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9m0 10 6-6m6 0 6 6" /></svg>
    );
};

export default TicketOpenedIcon;