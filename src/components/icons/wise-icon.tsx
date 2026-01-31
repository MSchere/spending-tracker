import * as React from "react";

interface WiseIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export function WiseIcon({ className, ...props }: WiseIconProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      id="Wise--Streamline-Simple-Icons"
      height="24"
      width="24"
    >
      <desc>Wise Streamline Icon: https://streamlinehq.com</desc>
      <title>Wise</title>
      <path
        d="M6.488 7.469 0 15.05h11.585l1.301 -3.576H7.922l3.033 -3.507 0.01 -0.092L8.993 4.48h8.873l-6.878 18.925h4.706L24 0.595H2.543l3.945 6.874Z"
        fill="#000000"
        strokeWidth="1"
      ></path>
    </svg>
  );
}
