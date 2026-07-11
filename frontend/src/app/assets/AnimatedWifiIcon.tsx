const AnimatedWifiIcon = () => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="-20 -20 120 160" 
      width="100" 
      height="100"
    >
      <style>{`
        .onda {
          fill: none;
          stroke: black;
          stroke-width: 8;
          stroke-linecap: round;
        }
        .punto {
          fill: black;
        }

        .w1 { animation: wave1 1.5s infinite; }
        .w2 { animation: wave2 1.5s infinite; }
        .w3 { animation: wave3 1.5s infinite; }
        .w4 { animation: wave4 1.5s infinite; }

        @keyframes wave1 {
          0%, 100% { opacity: 0.1; }
          20%, 90% { opacity: 1; }
        }
        
        @keyframes wave2 {
          0%, 25%, 100% { opacity: 0.1; }
          45%, 90% { opacity: 1; }
        }
        
        @keyframes wave3 {
          0%, 50%, 100% { opacity: 0.1; }
          70%, 90% { opacity: 1; }
        }

        @keyframes wave4 {
          0%, 75%, 100% { opacity: 0.1; }
          85%, 90% { opacity: 1; }
        }
      `}</style>

      <circle cx="50" cy="80" r="8" className="punto w1" />
      <path d="M 28,58 A 31,31 0 0,1 72,58" className="onda w2" />
      <path d="M 8,38 A 59,59 0 0,1 92,38" className="onda w3" />
      <path d="M -12,18 A 80,80 0 0,1 112,18" className="onda w4" />
      <text 
        x="-18" 
        y="130" 
        fontFamily="Arial, sans-serif" 
        fontSize="24" 
        fontWeight="bold" 
        fill="#333"
      >
        GMP Redes
      </text>
    </svg>
  );
};

export default AnimatedWifiIcon;
