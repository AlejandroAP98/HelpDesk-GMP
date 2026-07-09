const ChangeStatusIcon = ({strokeWidth = 2, className=""}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon icon-tabler icons-tabler-outline icon-tabler-status-change ${className}`}
      height={18}
      strokeWidth={strokeWidth}
      width={18}
      viewBox="0 0 24 24"
    >
      <path fill="none" stroke="none" d="M0 0h24v24H0z" />
      <path d="M4 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0m12 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M6 12v-2a6 6 0 1 1 12 0v2" />
      <path d="m15 9 3 3 3-3" />
    </svg>
  );
};

export default ChangeStatusIcon;