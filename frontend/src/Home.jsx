import React, { useEffect, useRef, useState } from "react";
import Alert from "./Alert.jsx";
import { backendActor } from "./backendActor.jsx";
import { useAuth } from "./auth.jsx";
import { Principal } from "@dfinity/principal";

const Home = ({}) => {
  const canvasRef = useRef(null);
  const { principal } = useAuth();
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const pixelRatio = window.devicePixelRatio || 1;
    const width = (canvas.width = window.innerWidth * pixelRatio);
    const height = (canvas.height = window.innerHeight * pixelRatio);

    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.scale(pixelRatio, pixelRatio);

    const particleCount = 80;
    const particles = [];
    const connectionDistance = 120;
    const lineColor = "rgba(60, 60, 60, 0.75)";
    const nodeColor = "rgba(40, 40, 40, 0.6)";

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 1,
        uniqueId: i,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((particle) => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        if (particle.x < 0 || particle.x > window.innerWidth) particle.speedX *= -1;
        if (particle.y < 0 || particle.y > window.innerHeight) particle.speedY *= -1;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor;
        ctx.fill();

        particles.forEach((otherParticle) => {
          if (particle.uniqueId < otherParticle.uniqueId) {
            const dx = particle.x - otherParticle.x;
            const dy = particle.y - otherParticle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < connectionDistance) {
              const opacity = 1 - distance / connectionDistance;

              ctx.beginPath();
              ctx.moveTo(particle.x, particle.y);
              ctx.lineTo(otherParticle.x, otherParticle.y);

              ctx.strokeStyle = `rgba(60, 60, 60, ${opacity * 0.75 + 0.1})`;
              ctx.lineWidth = 1;

              ctx.imageSmoothingEnabled = false;
              ctx.stroke();
            }
          }
        });
      });

      requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      const newPixelRatio = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * newPixelRatio;
      canvas.height = window.innerHeight * newPixelRatio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(newPixelRatio, newPixelRatio);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  async function getReleasedCampaigns() {
    if (principal) {
      const result = await backendActor.getReleasedCampaigns(Principal.fromText(principal));
      if (result && result.length > 0) {
        const campaignsList = result.join(", ");
        setAlert({
          type: "success",
          message: `Your campaign${result.length > 1 ? "s" : ""} ${campaignsList} ${result.length > 1 ? "are" : "is"} ready to be collected. Check your profile.`,
        });
      }
    }
  }

  useEffect(() => {
    getReleasedCampaigns();
  }, [principal]);

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
      <section className="w-full flex flex-col items-center text-center text-gray-800">
        <div className="relative flex w-full h-screen">
          <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" style={{ imageRendering: "crisp-edges" }} />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-5 text-gray-800 font-bold text-center z-10">
            <h1 className="text-4xl">VeriFund</h1>
            <h2 className="text-xl">Secure your kindness with Verifund!</h2>
          </div>
        </div>
      </section>

      <section className="bg-[#12A3ED] w-full py-12">
        <div className="w-[80%] mx-auto text-center text-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {["Donations You Can Trust", "Proof-of-Usage, Not Just Promises", "Decentralized, Borderless, Built on ICP"].map((point, index) => (
              <div key={index} className="flex flex-col items-center justify-center">
                <h3 className="text-2xl font-semibold">{point}</h3>
                {index < 2 && (
                  <div
                    className="hidden md:block absolute h-24 w-px bg-white"
                    style={{
                      right: `calc(${(100 / 3) * (index + 1)}% - 0.5px)`,
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about-section" className="w-[80%] flex justify-center py-20">
        <div className="w-full text-justify flex flex-col items-center gap-10">
          <h2 className="text-4xl font-bold text-gray-800 text-center">About VeriFund</h2>
          <div className="w-full flex flex-col">
            <p className="text-lg text-gray-700 leading-relaxed">
              <span className="font-bold">VeriFund</span> is a decentralized, trustless platform built to revolutionize how people give. Powered by the Internet Computer, VeriFund allows anyone to
              create or contribute to donation campaigns with transparency, verifiability, and global accessibility.
            </p>
            <p className="text-lg text-gray-700 mt-4 leading-relaxed">
              Every donation is stored on-chain, publicly auditable, and protected by smart contract rules — ensuring that funds are responsibly used. With a unique proof-of-donation and
              proof-of-usage model, VeriFund builds a culture of accountability without compromise.
            </p>
          </div>
          <div className="w-full flex flex-col">
            <h3 className="text-2xl font-bold text-gray-800">Vision</h3>
            <p className="text-lg text-gray-700 mt-2">To create a borderless, trustless, and transparent giving ecosystem where every donation is secure, verifiable, and meaningful.</p>
          </div>
          <div className="w-full flex flex-col">
            <h3 className="text-2xl font-bold text-gray-800">Mission</h3>
            <ul className="text-lg text-gray-700 list-disc list-inside mt-2 space-y-1">
              <li>Make donations verifiable</li>
              <li>Break down global donation barriers</li>
              <li>Establish trust through blockchain technology</li>
              <li>Reward responsible fundraisers and auditors</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
