/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { gsap } from 'gsap';

type AppState = 'homepage' | 'selecting' | 'selected' | 'cracking' | 'splitting' | 'revealing_slip' | 'revealed' | 'history';

const FORTUNE_QUOTES: string[] = [];

const DEV_MODE = true;

const LUCKY_COLORS = [
  { name: "Coral", hex: "#FF7F7F" },
  { name: "Sage Green", hex: "#9DC183" },
  { name: "Lavender", hex: "#B57EDC" },
  { name: "Amber", hex: "#FFBF00" },
  { name: "Sky Blue", hex: "#87CEEB" },
  { name: "Rose Pink", hex: "#FF66B2" },
  { name: "Mint", hex: "#98FF98" },
  { name: "Gold", hex: "#FFD700" },
  { name: "Periwinkle", hex: "#CCCCFF" },
  { name: "Teal", hex: "#008080" },
  { name: "Peach", hex: "#FFCBA4" },
  { name: "Crimson", hex: "#DC143C" },
  { name: "Ivory", hex: "#FFFFF0" },
  { name: "Slate", hex: "#708090" },
  { name: "Mauve", hex: "#E0B0FF" },
  { name: "Tangerine", hex: "#FF9966" },
  { name: "Blush", hex: "#DE5D83" },
  { name: "Ocean", hex: "#006994" },
  { name: "Honey", hex: "#EB9605" },
  { name: "Lilac", hex: "#C8A2C8" }
];

const MOBILE_COOKIE_OFFSETS = [
  { x: -90, y: -50, rotate: -15 },
  { x:  90, y: -50, rotate:  15 },
  { x: -90, y:  80, rotate: -10 },
  { x:  90, y:  80, rotate:  10 }
];

const COOKIE_OFFSETS = [
  { x: -360, y: 20, rotate: -20 },
  { x: -120, y: -20, rotate: -8 },
  { x: 120, y: -20, rotate: 8 },
  { x: 360, y: 20, rotate: 20 }
];

export default function App() {
  const [appState, setAppState] = useState<AppState>('homepage');
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  const [selectedCookieIndex, setSelectedCookieIndex] = useState<number | null>(null);
  const [openedToday, setOpenedToday] = useState<number[]>([]);
  const [showLimitMessage, setShowLimitMessage] = useState(false);
  
  const bgRef = useRef<HTMLDivElement>(null);
  const audioBuzzRef = useRef<HTMLAudioElement>(null);
  const audioBgmRef = useRef<HTMLAudioElement>(null);
  const audioCrackRef = useRef<HTMLAudioElement>(null);
  const audioPaperSlideRef = useRef<HTMLAudioElement>(null);
  const cookiesContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cookieRefs = useRef<(HTMLDivElement | null)[]>([]);
  const titleRef = useRef<HTMLParagraphElement>(null);

  const [fortuneText, setFortuneText] = useState("");
  const [showQuoteText, setShowQuoteText] = useState(false);
  const [splitGap, setSplitGap] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [crumbs, setCrumbs] = useState<{x: number, y: number, vx: number, vy: number, size: number, opacity: number}[]>([]);
  const [crackPath, setCrackPath] = useState<{x: number, y: number}[]>([]);
  const [fortuneData, setFortuneData] = useState<{color: typeof LUCKY_COLORS[0], wealth: number, love: number, career: number} | null>(null);
  
  const selectedCookieRef = useRef<HTMLDivElement>(null);
  const slipRef = useRef<HTMLDivElement>(null);
  const saveSlipRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const splitCenterRef = useRef<number>(50);
  const jaggedOffsetsRef = useRef<number[]>([]);

  // Load quotes from external JSON
  useEffect(() => {
    fetch('/data/quotes.json')
      .then(res => res.json())
      .then((data: string[]) => {
        FORTUNE_QUOTES.length = 0;
        FORTUNE_QUOTES.push(...data);
      })
      .catch(e => console.error("Failed to load quotes:", e));
  }, []);

  const todayKey = useMemo(() => new Date().toISOString().split('T')[0], []);
  const isFirstTimeCracker = useMemo(() => localStorage.getItem('cracked_before') !== 'true', []);

  const startAudio = () => {
    if (audioBuzzRef.current && audioBuzzRef.current.paused) {
      audioBuzzRef.current.volume = 0.10;
      audioBuzzRef.current.play().catch(e => console.log("Audio play blocked", e));
    }
    if (audioBgmRef.current && audioBgmRef.current.paused) {
      audioBgmRef.current.volume = 0.05;
      audioBgmRef.current.play().catch(e => console.log("Audio play blocked", e));
    }
  };

  useEffect(() => {
    // Check onboarding status
    const completed = localStorage.getItem('onboarding_completed') === 'true';
    setOnboardingCompleted(completed);

    if (completed) {
      setAppState('selecting');
      // Use a small delay or next tick to ensure ref is available
      setTimeout(() => {
        if (bgRef.current) {
          gsap.set(bgRef.current, { scale: 1.3 });
        }
      }, 0);
    }

    // Check opened cookies today
    const stored = localStorage.getItem(`opened_${todayKey}`);
    if (stored) {
      setOpenedToday(JSON.parse(stored));
    }

    // Check screen size
    const imagesToPreload = [
      '/visual/paper-slip.webp',
      '/visual/parchment.webp',
      '/visual/cookie-1.png',
      '/visual/cookie-2.png',
      '/visual/cookie-3.png',
      '/visual/cookie-4.png',
      window.innerWidth <= 768 ? '/visual/bg-table-mobile.webp' : '/visual/bg-table-desktop.webp'
    ];
    imagesToPreload.forEach(src => { const img = new Image(); img.src = src; });
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Global interaction listener for audio (especially for returning users)
    const handleFirstInteraction = () => {
      startAudio();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [todayKey]);

  const handleBegin = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    // Play audio
    startAudio();

    // Check if all cookies are opened today
    if (!DEV_MODE && openedToday.length >= 4) {
      setShowLimitMessage(true);
      setTimeout(() => {
        setShowLimitMessage(false);
        setIsTransitioning(false);
      }, 4000);
      return;
    }

    // GSAP Animation
    if (bgRef.current) {
      gsap.to(bgRef.current, {
        scale: 1.3,
        duration: 1.2,
        ease: "power2.inOut",
        onComplete: () => {
          localStorage.setItem('onboarding_completed', 'true');
          setOnboardingCompleted(true);
          setAppState('selecting');
          setIsTransitioning(false);
        }
      });
    }
  };

  // Entry animation for cookies
  useEffect(() => {
    if (appState === 'selecting' && cookiesContainerRef.current) {
      // Animate title
      gsap.fromTo(titleRef.current, 
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.8, delay: 0.5 }
      );

      // Animate cookies
      cookieRefs.current.forEach((ref, i) => {
        if (ref && !openedToday.includes(i + 1)) {
          gsap.fromTo(ref, 
            { y: 500, opacity: 0, scale: 0.5 },
            { 
              y: 0, 
              opacity: 1, 
              scale: 1, 
              duration: 1, 
              delay: 0.2 + (i * 0.15),
              ease: "back.out(1.7)",
              onComplete: () => {
                // Idle animation
                gsap.to(ref, {
                  y: "-=3",
                  duration: 1.5 + Math.random(),
                  repeat: -1,
                  yoyo: true,
                  ease: "sine.inOut"
                });
              }
            }
          );
        }
      });
    }
  }, [appState, openedToday]);

  const handleCookieClick = (index: number) => {
    if (appState !== 'selecting' || openedToday.includes(index + 1)) return;
    
    setSelectedCookieIndex(index);
    setAppState('selected');

    // Animate selection
    cookieRefs.current.forEach((ref, i) => {
      if (ref) {
        gsap.killTweensOf(ref);
        if (i === index) {
          // Move selected to center and scale
          gsap.to(ref, {
            x: 0,
            y: 0,
            scale: isMobile ? 1.8 : 2.5,
            duration: 0.6,
            ease: "power3.out",
            zIndex: 100,
            onComplete: () => {
              // Subtle bounce animation to hint at interaction
              gsap.to(ref, {
                y: -10,
                duration: 0.4,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut"
              });
            }
          });
        } else {
          // Fade out others
          gsap.to(ref, {
            opacity: 0,
            scale: 0.5,
            duration: 0.4,
            ease: "power2.in"
          });
        }
      }
    });

    // Fade out title
    gsap.to(titleRef.current, { opacity: 0, duration: 0.3 });
  };

  const handleCookieTap = () => {
    if (appState !== 'selected' || selectedCookieIndex === null) return;

    if (DEV_MODE) console.log("State Transition: selected -> cracking");
    setAppState('cracking');
    
    // Generate jagged crack parameters
    splitCenterRef.current = 42 + Math.random() * 16;
    const offsets = [];
    for (let i = 0; i <= 10; i++) {
      // ±2-4% offset
      const val = 2 + Math.random() * 2;
      offsets.push(val * (Math.random() > 0.5 ? 1 : -1));
    }
    jaggedOffsetsRef.current = offsets;

    // Pick random fortune early so it's visible during splitting
    const randomFortune = FORTUNE_QUOTES[Math.floor(Math.random() * FORTUNE_QUOTES.length)];
    setFortuneText(randomFortune);

    // Play crack sound
    if (audioCrackRef.current) {
      audioCrackRef.current.currentTime = 0;
      audioCrackRef.current.volume = 0.4;
      audioCrackRef.current.play().catch(e => console.log("Audio play blocked", e));
    }

    // Shake animation
    const selectedRef = cookieRefs.current[selectedCookieIndex];
    if (selectedRef) {
      gsap.to(selectedRef, {
        rotation: "+=3",
        duration: 0.05,
        repeat: 5,
        yoyo: true,
        ease: "sine.inOut",
        onComplete: () => {
          if (DEV_MODE) console.log("State Transition: cracking -> splitting");
          setAppState('splitting');
        }
      });
    }

    // Spawn initial crumbs along the crack line
    const startX = (splitCenterRef.current / 100) * 320;
    const newCrumbs = [];
    for (let i = 0; i < 15; i++) {
      newCrumbs.push({
        x: startX + (Math.random() * 10 - 5),
        y: 80 + Math.random() * 160, // Along the vertical break
        vx: (Math.random() * 6 - 3),
        vy: (Math.random() * -3 - 1),
        size: Math.random() * 5 + 2,
        opacity: 1
      });
    }
    setCrumbs(newCrumbs);
  };

  // Crumb physics loop
  useEffect(() => {
    if (crumbs.length === 0) return;

    let animationFrame: number;
    const update = () => {
      setCrumbs(prev => prev.map(c => {
        let newVy = c.vy + 0.25; // gravity
        let newY = c.y + newVy;
        let newX = c.x + c.vx;
        let newVx = c.vx;

        // Simple bounce on "floor" (y=300)
        if (newY > 300) {
          newY = 300;
          newVy *= -0.4; // bounce
          newVx *= 0.8; // friction
        }

        return {
          ...c,
          x: newX,
          y: newY,
          vx: newVx,
          vy: newVy,
          opacity: c.opacity - 0.008
        };
      }).filter(c => c.opacity > 0));
      
      animationFrame = requestAnimationFrame(update);
    };

    animationFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrame);
  }, [crumbs.length]);

  // Canvas drawing
  useEffect(() => {
    if (!canvasRef.current || (appState !== 'cracking' && appState !== 'splitting')) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 800, 800);
    
    // Draw crumbs
    crumbs.forEach(c => {
      ctx.fillStyle = `rgba(212, 168, 71, ${c.opacity})`; // Golden
      ctx.beginPath();
      ctx.arc(c.x * 2.5, c.y * 2.5, c.size * 1.5, 0, Math.PI * 2); // Scale crumbs to match 800px container
      ctx.fill();
    });
  }, [crumbs, appState]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (appState !== 'splitting') return;
    e.preventDefault();
    setIsDragging(true);
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setStartX(x);
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || appState !== 'splitting') return;
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const delta = Math.abs(x - startX);
    
    // Smooth real-time update
    setSplitGap(delta);

    // Spawn occasional crumbs during drag
    if (Math.random() > 0.85) {
      setCrumbs(prev => [...prev, {
        x: 160 + (Math.random() * 20 - 10),
        y: 160 + (Math.random() * 40 - 20),
        vx: (Math.random() * 2 - 1),
        vy: Math.random() * 2,
        size: Math.random() * 4 + 2,
        opacity: 1
      }]);
    }

    const threshold = isMobile ? 120 : 180;
    if (delta >= threshold) {
      handleFullSplit();
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleFullSplit = () => {
    if (DEV_MODE) console.log("State Transition: splitting -> revealing_slip");
    setIsDragging(false);
    setAppState('revealing_slip');
    
    // Generate/Load daily fortune data
    const storedFortune = localStorage.getItem(`fortune_${todayKey}`);
    if (storedFortune) {
      setFortuneData(JSON.parse(storedFortune));
    } else {
      const seededRandom = (seed: string) => {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
          hash = ((hash << 5) - hash) + seed.charCodeAt(i);
          hash |= 0;
        }
        return () => {
          hash = (hash * 16807) % 2147483647;
          return (hash - 1) / 2147483646;
        };
      };
      
      const rand = seededRandom(todayKey);
      const data = {
        color: LUCKY_COLORS[Math.floor(rand() * LUCKY_COLORS.length)],
        wealth: Math.floor(rand() * 8) * 0.5 + 1.5,
        love: Math.floor(rand() * 8) * 0.5 + 1.5,
        career: Math.floor(rand() * 8) * 0.5 + 1.5
      };
      setFortuneData(data);
      localStorage.setItem(`fortune_${todayKey}`, JSON.stringify(data));
    }

    // Play paper slide sound
    if (audioPaperSlideRef.current) {
      audioPaperSlideRef.current.currentTime = 0;
      audioPaperSlideRef.current.volume = 0.5;
      audioPaperSlideRef.current.play().catch(e => console.log("Audio play blocked", e));
    }

    // Mark as opened
    const newOpened = [...openedToday, (selectedCookieIndex || 0) + 1];
    setOpenedToday(newOpened);
    localStorage.setItem(`opened_${todayKey}`, JSON.stringify(newOpened));
    localStorage.setItem('cracked_before', 'true');

    // Save to history
    const historyKey = 'fortune_history';
    const existingHistory = JSON.parse(localStorage.getItem(historyKey) || '[]');
    existingHistory.unshift({
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      quote: fortuneText,
      color: fortuneData?.color || LUCKY_COLORS[0],
      wealth: fortuneData?.wealth || 3,
      love: fortuneData?.love || 3,
      career: fortuneData?.career || 3
    });
    localStorage.setItem(historyKey, JSON.stringify(existingHistory));
  };

  const handleRevealFortune = () => {
    if (appState !== 'revealing_slip') return;
    if (DEV_MODE) console.log("State Transition: revealing_slip -> revealed");
    setAppState('revealed');
  };

  const handleSaveFortune = async () => {
    try {
      // Temporarily show a hidden high-res version for capture
      const captureDiv = document.createElement('div');
      captureDiv.style.position = 'fixed';
      captureDiv.style.left = '-9999px';
      captureDiv.style.top = '0';
      captureDiv.style.width = '700px';
      captureDiv.style.height = '400px';
      captureDiv.style.display = 'flex';
      captureDiv.style.alignItems = 'center';
      captureDiv.style.justifyContent = 'center';
      captureDiv.style.background = 'transparent';

      // Paper slip image
      const img = document.createElement('img');
      img.src = '/visual/paper-slip.webp';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.style.position = 'absolute';
      captureDiv.appendChild(img);

      // Quote text overlay
      const textDiv = document.createElement('div');
      textDiv.style.position = 'absolute';
      textDiv.style.inset = '0';
      textDiv.style.display = 'flex';
      textDiv.style.alignItems = 'center';
      textDiv.style.justifyContent = 'center';
      textDiv.style.padding = '40px 30px';
      textDiv.style.textAlign = 'center';
      textDiv.style.fontFamily = "'EB Garamond', serif";
      textDiv.style.fontSize = '20px';
      textDiv.style.fontWeight = '500';
      textDiv.style.color = '#1A3A5C';
      textDiv.style.fontStyle = 'italic';
      textDiv.style.lineHeight = '1.3';
      // Apply same line-break logic as formatFortune()
      const breakChars = [',', ';', '.'];
      let formattedText = fortuneText;
      for (const char of breakChars) {
        const idx = fortuneText.indexOf(char);
        if (idx !== -1 && idx > 10 && idx < fortuneText.length - 10) {
          formattedText = fortuneText.substring(0, idx + 1) + '\n' + fortuneText.substring(idx + 1).trim();
          break;
        }
      }
      textDiv.style.whiteSpace = 'pre-line';
      textDiv.textContent = formattedText;
      captureDiv.appendChild(textDiv);

      document.body.appendChild(captureDiv);

      // Wait for image to load
      await new Promise(resolve => {
        if (img.complete) resolve(true);
        else img.onload = () => resolve(true);
      });

      const canvas = await html2canvas(captureDiv, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
        logging: false
      });

      document.body.removeChild(captureDiv);

      // Trigger download
      const link = document.createElement('a');
      link.download = `fortune-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      if (DEV_MODE) console.log("Fortune saved as PNG");
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const handleBackHome = () => {
    setAppState('selecting');
    setSelectedCookieIndex(null);
    setSplitGap(0);
    setFortuneText("");
    setShowQuoteText(false);
    setCrackPath([]);
    setCrumbs([]);
    setFortuneData(null);
    
    // Reset background zoom if needed (it's already 1.3)
  };

  const handleReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  const formatFortune = (text: string) => {
    const breakPoints = [',', ';', '.'];
    for (let char of breakPoints) {
      const idx = text.indexOf(char);
      if (idx !== -1 && idx > 10 && idx < text.length - 10) {
        return (
          <>
            {text.substring(0, idx + 1)}
            <br />
            {text.substring(idx + 1).trim()}
          </>
        );
      }
    }
    return text;
  };

  // Step 5: Animation Sequence
  useEffect(() => {
    if (appState === 'revealing_slip' && slipRef.current) {
      // Initial entrance when it first appears after splitting
      gsap.killTweensOf(slipRef.current);
     gsap.fromTo(slipRef.current,
        { opacity: 0, top: '20%', scale: 0.8 },
        { 
          opacity: 1, 
          top: '20%', 
          scale: 1, 
          duration: 0.8, 
          ease: "power2.out",
          onComplete: () => setShowQuoteText(true)
        }
      );
    }

  if (appState === 'revealed' && slipRef.current) {
      gsap.to(slipRef.current, {
        top: '-15vh',
        duration: 0.8,
        ease: "power2.inOut",
        onComplete: () => {
          // Start sway animation
          gsap.to(slipRef.current, {
            rotation: 1,
            y: "-=5",
            duration: 1.5,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
          });
        }
      });

      // Parchment unroll animation
      if (cardRef.current) {
        gsap.fromTo(cardRef.current,
          { opacity: 0, scale: 0.8, y: 30 },
          { opacity: 1, scale: 1, y: 0, duration: 0.8, delay: 0.5, ease: "power2.out" }
        );
        
        // Staggered fade in for lines
        const lines = cardRef.current.querySelectorAll('.parchment-line');
        gsap.fromTo(lines, 
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.3, delay: 1.3 }
        );
      }

      // Buttons fade in last
      if (buttonsRef.current) {
        gsap.fromTo(buttonsRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.3, delay: 3.0 }
        );
      }
    }
  }, [appState]);

  const getJaggedClipPath = (isLeft: boolean) => {
    const center = splitCenterRef.current;
    const offsets = jaggedOffsetsRef.current;
    if (offsets.length === 0) return isLeft ? 'inset(0 50% 0 0)' : 'inset(0 0 0 50%)';

    const points = offsets.map((offset, i) => {
      const y = (i / (offsets.length - 1)) * 100;
      const x = center + offset;
      return `${x.toFixed(2)}% ${y.toFixed(2)}%`;
    });

    if (isLeft) {
      return `polygon(0% 0%, ${points.join(', ')}, 0% 100%)`;
    } else {
      // For right side, we need to go around the other way to close the shape
      const reversedPoints = [...points].reverse();
      return `polygon(${points[0]}, 100% 0%, 100% 100%, ${reversedPoints.join(', ')})`;
    }
  };

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100dvh',
    minHeight: '-webkit-fill-available',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF8E8',
    userSelect: 'none',
    WebkitUserSelect: 'none'
  };

  const bgStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundImage: `url(${isMobile ? '/visual/bg-table-mobile.webp' : '/visual/bg-table-desktop.webp'})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    transition: 'opacity 0.5s duration'
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: 10,
    pointerEvents: 'none'
  };

  const navStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '24px',
    pointerEvents: 'auto'
  };

  const iconButtonStyle: React.CSSProperties = {
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0
  };

  const gearButtonStyle: React.CSSProperties = {
    fontSize: '32px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const onboardingStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    cursor: 'pointer'
  };

  const pulseCircleStyle: React.CSSProperties = {
    width: '64px',
    height: '64px',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: '50%',
    border: '2px solid white',
    marginBottom: '16px'
  };

  const onboardingTextStyle: React.CSSProperties = {
    color: 'white',
    fontFamily: "'Playfair Display', serif",
    fontSize: isMobile ? '26px' : '50px',
    fontWeight: 'bold',
    letterSpacing: '0.05em',
    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
    textAlign: 'center',
    width: '90%',
    padding: '0 20px'
  };

  const cookiesContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: '1000px',
    height: isMobile ? '280px' : '300px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'auto'
  };

  const getCookieStyle = (index: number): React.CSSProperties => {
    const offset = isMobile ? MOBILE_COOKIE_OFFSETS[index] : COOKIE_OFFSETS[index];
    
    return {
      position: 'absolute',
      width: '180px',
      height: '180px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: `translate(${offset.x}px, ${offset.y}px) rotate(${offset.rotate}deg)`,
      cursor: openedToday.includes(index + 1) ? 'default' : 'pointer',
      transition: 'transform 0.25s ease-out, filter 0.25s ease-out',
      filter: openedToday.includes(index + 1) ? 'grayscale(1) opacity(0.2)' : 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))',
      zIndex: 10 + index
    };
  };

  const limitMessageStyle: React.CSSProperties = {
    position: 'absolute',
    width: '80%',
    maxWidth: '320px',
    textAlign: 'center',
    color: 'white',
    fontFamily: "'Playfair Display', serif",
    fontSize: '20px',
    lineHeight: '1.4',
    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
    zIndex: 100,
    backgroundColor: 'rgba(26, 58, 92, 0.8)',
    padding: '24px',
    borderRadius: '16px',
    backdropFilter: 'blur(8px)'
  };

  return (
    <div style={containerStyle}>
      {/* Background Layer */}
      <div ref={bgRef} style={bgStyle} />

      {/* UI Overlay */}
      <div style={overlayStyle}>
        {/* Top Navigation */}
        <div style={navStyle}>
          <button onClick={() => setAppState('history')} style={iconButtonStyle} title="History">
            <img src="/visual/wall-calendar-icon.webp" alt="History" style={{ width: '100%', height: '100%', objectFit: 'contain' }} referrerPolicy="no-referrer" />
          </button>
          <button onClick={() => console.log("Settings Clicked")} style={gearButtonStyle} title="Settings">⚙️</button>
        </div>

        {/* Home State */}
        {appState === 'homepage' && !onboardingCompleted && !showLimitMessage && (
          <div style={onboardingStyle} onClick={handleBegin}>
            <div className="pulse-circle" style={pulseCircleStyle} />
            <p style={onboardingTextStyle}>Tap anywhere to begin</p>
          </div>
        )}

        {/* Limit Message */}
        {showLimitMessage && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyCenter: 'center', pointerEvents: 'auto' }}>
            <div style={{ ...limitMessageStyle, margin: 'auto' }}>
              The future doesn't reveal itself so easily. Come back tomorrow.
            </div>
          </div>
        )}

        {/* Selection State */}
        {(appState === 'selecting' || appState === 'selected') && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p 
              ref={titleRef}
              style={{
                ...onboardingTextStyle,
                position: 'absolute',
                top: isMobile ? '42%' : '10%',
                opacity: 0,
                textAlign: 'center',
                width: '100%',
                margin: 0,
                fontSize: isMobile ? '22px' : '50px'
              }}
            >
              Pick your fortune for today
            </p>

            {/* Tooltip for selection */}
            {appState === 'selected' && (
              <div 
                style={{
                  position: 'absolute',
                  top: '18%',
                  color: 'white',
                  fontFamily: "'Playfair Display', serif",
                  fontStyle: 'italic',
                  fontWeight: 'bold',
                  fontSize: '32px',
                  textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                  textAlign: 'center',
                  animation: 'fadeIn 0.8s ease-out forwards',
                  width: '100%'
                }}
              >
                Tap to crack it open
              </div>
            )}
            
            <div ref={cookiesContainerRef} style={cookiesContainerStyle}>
              {[1, 2, 3, 4].map((num, i) => (
                <div
                  key={num}
                  ref={el => cookieRefs.current[i] = el}
                  style={getCookieStyle(i)}
                  onClick={() => {
                    if (appState === 'selecting') {
                      handleCookieClick(i);
                    } else if (appState === 'selected' && i === selectedCookieIndex) {
                      handleCookieTap();
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (appState === 'selecting' && !openedToday.includes(num)) {
                      const el = e.currentTarget;
                      el.style.transform += ' translateY(-10px) scale(1.1)';
                      el.style.filter = 'drop-shadow(0 12px 15px rgba(0,0,0,0.4))';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (appState === 'selecting' && !openedToday.includes(num)) {
                      const el = e.currentTarget;
                      const offset = COOKIE_OFFSETS[i];
                      el.style.transform = `translate(${offset.x}px, ${offset.y}px) rotate(${offset.rotate}deg)`;
                      el.style.filter = 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))';
                    }
                  }}
                >
                  {!openedToday.includes(num) ? (
                    <img 
                      src={`/visual/cookie-${num}.png`} 
                      alt={`Cookie ${num}`} 
                      style={{ width: isMobile ? '130px' : '320px', height: isMobile ? '130px' : '320px', minWidth: isMobile ? '130px' : '320px', objectFit: 'contain' }}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {/* Crumb placeholder */}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cracking & Splitting State */}
        {(appState === 'cracking' || appState === 'splitting') && selectedCookieIndex !== null && (
          <div 
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          >
            {/* 800px container matches the 320px image scaled by 2.5 from the 'selected' state */}
            <div style={{ position: 'relative', width: '800px', height: '800px' }}>
              {/* Hint Text */}
              {appState === 'splitting' && splitGap < 20 && (
                <div 
                  style={{
                    position: 'absolute',
                    top: '15%',
                    left: 0,
                    width: '100%',
                    color: 'white',
                    fontFamily: "'Playfair Display', serif",
                    fontStyle: 'italic',
                    fontWeight: 'bold',
                    fontSize: '24px',
                    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                    textAlign: 'center',
                    animation: 'fadeIn 0.8s ease-out forwards',
                    zIndex: 20
                  }}
                >
                  Drag to pull apart
                </div>
              )}

              {/* Paper Slip Masked Wrapper (Revealed as gap grows) */}
              <div 
                style={{ 
                  position: 'absolute', 
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: `${splitGap * 2}px`, 
                  height: '100%',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  overflow: 'hidden',
                  pointerEvents: 'none',
                  zIndex: 5,
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  WebkitTouchCallout: 'none'
                }}
              >
                <div style={{ position: 'relative', width: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img 
                    src="/visual/paper-slip.webp" 
                    alt="Paper Slip" 
                    style={{ 
                      width: '100%',
                      height: 'auto',
                      objectFit: 'contain',
                      opacity: Math.min(splitGap / 30, 1)
                    }} 
                    referrerPolicy="no-referrer" 
                  />
                  {showQuoteText && (
                    <div 
                      style={{ 
                        position: 'absolute', 
                        inset: 0, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        padding: '16px 24px',
                        textAlign: 'center',
                        fontFamily: "'EB Garamond', serif",
                        fontSize: '24px', // Slightly larger for the 800px context
                        fontWeight: 500,
                        color: '#1A3A5C',
                        lineHeight: '1.3',
                        fontStyle: 'italic',
                        overflow: 'hidden',
                        opacity: Math.min(splitGap / 30, 1)
                      }}
                    >
                      {formatFortune(fortuneText)}
                    </div>
                  )}
                </div>
              </div>

              {/* Left Half (Clipped from main image) */}
              <div 
                style={{ 
                  position: 'absolute', 
                  left: '50%', 
                  top: '50%', 
                  width: '800px', 
                  height: '800px', 
                  transform: `translate(calc(-50% - ${splitGap}px), -50%)`,
                  clipPath: getJaggedClipPath(true),
                  cursor: appState === 'splitting' ? 'grab' : 'default',
                  pointerEvents: 'none',
                  zIndex: 10
                }}
              >
                <img 
                  src={`/visual/cookie-${selectedCookieIndex + 1}.png`} 
                  alt="Cookie Left" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Right Half (Clipped from main image) */}
              <div 
                style={{ 
                  position: 'absolute', 
                  left: '50%', 
                  top: '50%', 
                  width: '800px', 
                  height: '800px', 
                  transform: `translate(calc(-50% + ${splitGap}px), -50%)`,
                  clipPath: getJaggedClipPath(false),
                  cursor: appState === 'splitting' ? 'grab' : 'default',
                  pointerEvents: 'none',
                  zIndex: 10
                }}
              >
                <img 
                  src={`/visual/cookie-${selectedCookieIndex + 1}.png`} 
                  alt="Cookie Right" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Canvas Overlay for Crumbs */}
              <canvas 
                ref={canvasRef} 
                width={800} 
                height={800} 
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15 }} 
              />
            </div>
          </div>
        )}

        {/* Revealing Slip & Revealed State */}
        {(appState === 'revealing_slip' || appState === 'revealed') && (
          <div 
            style={{ 
              position: 'absolute', 
              inset: 0, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              pointerEvents: 'auto', 
              cursor: appState === 'revealing_slip' ? 'pointer' : 'default' 
            }}
            onClick={appState === 'revealing_slip' ? handleRevealFortune : undefined}
          >
{/* Paper Slip */}
            <div 
              ref={(el) => {
                (slipRef as any).current = el;
                (saveSlipRef as any).current = el;
              }}
              style={{ 
                position: 'fixed', 
                top: '20%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '90vw', 
                maxWidth: '450px', 
                minHeight: '100px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 20,
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none'
              }}
            >
              <img src="/visual/paper-slip.webp" alt="Paper Slip" style={{ width: '130%', height: 'auto', objectFit: 'contain' }} referrerPolicy="no-referrer" />
              {showQuoteText && (
                <div 
                  style={{ 
                    position: 'absolute', 
                    inset: 0, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: '16px 24px',
                    textAlign: 'center',
                    fontFamily: "'EB Garamond', serif",
                    fontSize: '20px',
                    fontWeight: 500,
                    color: '#1A3A5C',
                    lineHeight: '1.3',
                    fontStyle: 'italic',
                    overflow: 'hidden'
                  }}
                >
                  {formatFortune(fortuneText)}
                </div>
              )}
            </div>
            
            {/* Hint Text (revealing_slip only) */}
            {appState === 'revealing_slip' && (
              <div 
                style={{
                  position: 'fixed',
                  top: 'calc(30vh - 80px)',
                  left: 0,
                  width: '100%',
                  color: 'white',
                  fontFamily: "'Playfair Display', serif",
                  fontStyle: 'italic',
                  fontWeight: 'bold',
                  fontSize: '24px',
                  textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                  textAlign: 'center',
                  animation: 'fadeIn 1s ease-out 0.5s forwards',
                  opacity: 0
                }}
              >
                Tap to reveal today's fortune
              </div>
            )}

            {/* Fortune Card (Parchment Scroll) */}
            {appState === 'revealed' && (
              <div 
                style={{ 
                  position: 'fixed',
                  top: '20vh',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '80%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none'
                }}
              >
                <div 
                  ref={cardRef}
                  style={{ 
                    width: '50vw',
                    maxWidth: '240px',
                    maxHeight: '55vh',
                    backgroundColor: 'transparent',
                    backgroundImage: "url('/visual/parchment.webp')",
                    backgroundSize: '100% 100%',
                    backgroundRepeat: 'no-repeat',
                    padding: '15% 12%',
                    color: '#4A3520',
                    fontFamily: "'MedievalSharp', cursive",
                    overflow: 'hidden',
                    opacity: 0,
                    zIndex: 10,
                    position: 'relative',
                    pointerEvents: 'auto'
                  }}
                >
                  {/* Content Rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="parchment-line" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0 }}>
                      <span style={{ fontSize: '18px', color: '#4A3520' }}>Date</span>
                      <span style={{ fontSize: '18px', color: '#6D4C2A' }}>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>

                    <div className="parchment-line" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0 }}>
                      <span style={{ fontSize: '18px', color: '#4A3520' }}>Lucky Color</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px', color: '#6D4C2A' }}>{fortuneData?.color.name}</span>
                        <svg width="40" height="14" viewBox="0 0 40 14" style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '6px' }}>
                          <defs>
                            <filter id="rough">
                              <feTurbulence type="turbulence" baseFrequency="0.08" numOctaves="4" result="noise"/>
                              <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G"/>
                            </filter>
                          </defs>
                          <path d="M4 7 C6 3, 12 1, 20 2 C28 1, 34 3, 38 7 C34 11, 28 13, 20 12 C12 13, 6 11, 4 7Z" fill={fortuneData?.color.hex} filter="url(#rough)"/>
                        </svg>
                      </div>
                    </div>

                    <div className="parchment-line" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0 }}>
                      <span style={{ fontSize: '16px', color: '#4A3520' }}>Wealth</span>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {[1, 2, 3, 4, 5].map((star) => {
                          const isHalf = (fortuneData?.wealth || 0) === star - 0.5;
                          const isFull = (fortuneData?.wealth || 0) >= star;
                          return (
                            <div key={star} style={{ position: 'relative', width: '18px', height: '18px', fontSize: '16px' }}>
                              <span style={{ opacity: 0.25, position: 'absolute', inset: 0 }}>🥠</span>
                              {(isFull || isHalf) && (
                                <span style={{ 
                                  position: 'absolute', 
                                  inset: 0, 
                                  width: isHalf ? '50%' : '100%', 
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap'
                                }}>
                                  🥠
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="parchment-line" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0 }}>
                      <span style={{ fontSize: '16px', color: '#4A3520' }}>Love</span>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {[1, 2, 3, 4, 5].map((star) => {
                          const isHalf = (fortuneData?.love || 0) === star - 0.5;
                          const isFull = (fortuneData?.love || 0) >= star;
                          return (
                            <div key={star} style={{ position: 'relative', width: '18px', height: '18px', fontSize: '16px' }}>
                              <span style={{ opacity: 0.25, position: 'absolute', inset: 0 }}>🥠</span>
                              {(isFull || isHalf) && (
                                <span style={{ 
                                  position: 'absolute', 
                                  inset: 0, 
                                  width: isHalf ? '50%' : '100%', 
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap'
                                }}>
                                  🥠
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="parchment-line" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0 }}>
                      <span style={{ fontSize: '16px', color: '#4A3520' }}>Career</span>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {[1, 2, 3, 4, 5].map((star) => {
                          const isHalf = (fortuneData?.career || 0) === star - 0.5;
                          const isFull = (fortuneData?.career || 0) >= star;
                          return (
                            <div key={star} style={{ position: 'relative', width: '18px', height: '18px', fontSize: '16px' }}>
                              <span style={{ opacity: 0.25, position: 'absolute', inset: 0 }}>🥠</span>
                              {(isFull || isHalf) && (
                                <span style={{ 
                                  position: 'absolute', 
                                  inset: 0, 
                                  width: isHalf ? '50%' : '100%', 
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap'
                                }}>
                                  🥠
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{ height: '1px', backgroundColor: 'rgba(74,53,32,0.2)', margin: '12px 0' }} />

                    {/* Action Buttons */}
                    <div 
                      ref={buttonsRef}
                      style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        justifyItems: 'center',
                        opacity: 0
                      }}
                    >
                      {[
                        { label: 'Home', emoji: '←', action: handleBackHome },
                        { label: 'Save', emoji: '💾', action: handleSaveFortune },
                        { label: 'Share', emoji: '🔗', action: () => console.log("TODO: Share") },
                        { label: 'History', emoji: '📖', action: () => setAppState('history') }
                      ].map((btn) => (
                        <button
                          key={btn.label}
                          onClick={btn.action}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#4A3520',
                            fontFamily: "'MedievalSharp', cursive",
                            fontSize: '18px',
                            opacity: 0.7,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'opacity 0.2s',
                            padding: '6px 8px'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                        >
                          <span>{btn.emoji}</span>
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

        {/* History Page */}
        {appState === 'history' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            backgroundImage: "url('/visual/bg-history.webp')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: '#2C1810',
            backdropFilter: 'blur(10px)',
            overflowY: 'auto',
            padding: '40px 20px',
            pointerEvents: 'auto'
          }}>
            {/* Back Button */}
            <button
              onClick={() => { setAppState('selecting'); setSelectedCookieIndex(null); setSplitGap(0); setShowQuoteText(false); setCrumbs([]); setFortuneData(null); }}
              style={{
                position: 'fixed',
                top: '20px',
                left: '20px',
                background: 'none',
                border: 'none',
                color: '#4A3520',
                fontFamily: "'Playfair Display', serif",
                fontSize: '18px',
                cursor: 'pointer',
                zIndex: 60,
                opacity: 0.8
              }}
            >
              ← Back
            </button>

            {/* Title */}
            <h1 style={{
              textAlign: 'center',
              color: '#4A3520',
              fontFamily: "'Playfair Display', serif",
              fontSize: '28px',
              fontWeight: 'bold',
              marginBottom: '32px',
              letterSpacing: '0.05em'
            }}>
              My Fortune Collection
            </h1>

            {/* Masonry Grid */}
            {(() => {
              const history = JSON.parse(localStorage.getItem('fortune_history') || '[]');
              if (history.length === 0) {
                return (
                  <div style={{ textAlign: 'center', marginTop: '80px' }}>
                    <p style={{ color: '#4A3520', fontFamily: "'Playfair Display', serif", fontSize: '18px', fontStyle: 'italic', opacity: 0.7 }}>
                      Your fortune collection is empty.
                    </p>
                    <button
                      onClick={() => setAppState('selecting')}
                      style={{
                        marginTop: '24px',
                        background: 'rgba(255,255,255,0.15)',
                        border: '1px solid rgba(255,255,255,0.3)',
                        color: '#4A3520',
                        fontFamily: "'Playfair Display', serif",
                        fontSize: '16px',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      Go crack a cookie! 🥠
                    </button>
                  </div>
                );
              }
              return (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '16px',
                  maxWidth: '600px',
                  margin: '0 auto'
                }}>
                  {history.map((item: any, idx: number) => (
                    <div key={idx} style={{
                      position: 'relative',
                      backgroundColor: 'rgba(245, 230, 200, 0.9)',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: '-6px',
                        left: '16px',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6'][idx % 5],
                        boxShadow: 'inset -2px -2px 3px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.3)',
                        zIndex: 2
                      }} />
                      <p style={{
                        fontFamily: "'EB Garamond', serif",
                        fontSize: '15px',
                        fontStyle: 'italic',
                        color: '#1A3A5C',
                        lineHeight: '1.4',
                        margin: 0
                      }}>
                        "{item.quote}"
                      </p>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '4px'
                      }}>
                        <span style={{
                          fontFamily: "'MedievalSharp', cursive",
                          fontSize: '12px',
                          color: '#6D4C2A',
                          opacity: 0.7
                        }}>
                          {item.date}
                        </span>
                        <div style={{
                          width: '20px',
                          height: '8px',
                          backgroundColor: item.color?.hex || '#D4A847',
                          borderRadius: '40% 60% 50% 45%',
                          transform: 'rotate(-3deg)'
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

      {/* DEV MODE Reset Button */}
      {DEV_MODE && (
        <button 
          onClick={handleReset}
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            padding: '8px 16px',
            backgroundColor: 'rgba(0,0,0,0.5)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            zIndex: 1000,
            pointerEvents: 'auto'
          }}
        >
          🔧 Reset
        </button>
      )}

      {/* Audio Elements */}
      <audio ref={audioBuzzRef} src="/audio/buzz.wav" loop />
      <audio ref={audioBgmRef} src="/audio/bgm.wav" loop />
      <audio ref={audioCrackRef} src="/audio/crack.wav" />
      <audio ref={audioPaperSlideRef} src="/audio/paper-slide.wav" />

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatUp {
          0% { opacity: 0; transform: translateY(100px) scale(0.8); }
          60% { opacity: 1; transform: translateY(-20px) scale(1.05); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes sway {
          0%, 100% { transform: rotate(-1deg) translateY(0); }
          50% { transform: rotate(1deg) translateY(-5px); }
        }
      `}</style>
    </div>
  );
}
