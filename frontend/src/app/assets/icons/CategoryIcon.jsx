const CategoryIcon = ({className = "", strokeWidth = 1.5}) => {
    return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className={`icon icon-tabler icons-tabler-outline icon-tabler-category ${className}`} height={24} strokeWidth={strokeWidth} width={24} viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 3a3 3 0 1 0 6 0 3 3 0 1 0-6 0"/></svg>)
}

export default CategoryIcon;