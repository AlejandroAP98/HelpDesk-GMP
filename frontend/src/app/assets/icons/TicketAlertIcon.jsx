const TicketAlertIcon = ({ strokeWidth = 1.5, className = "" }) => {
    return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={`icon icon-tabler icons-tabler-outline icon-tabler-alert-triangle ${className}`} height={24} strokeWidth={strokeWidth} width={24} viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M12 9v4m-1.637-9.409L2.257 17.125a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636-2.87L13.637 3.59a1.914 1.914 0 0 0-3.274 0M12 16h.01"/></svg>
    );
};

export default TicketAlertIcon;