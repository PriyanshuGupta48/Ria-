import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard from './ProductCard';

const SKELETON_COUNT = 4;

const SkeletonCard = () => (
  <div className="flex-none w-[82vw] sm:w-[46vw] lg:w-[23%] snap-start">
    <div className="card overflow-hidden animate-pulse">
      <div className="bg-slate-200 aspect-video sm:h-64 w-full" />
      <div className="p-3 sm:p-4 space-y-3">
        <div className="h-4 w-24 bg-slate-200 rounded-full" />
        <div className="h-5 w-11/12 bg-slate-200 rounded-xl" />
        <div className="h-4 w-20 bg-slate-200 rounded-full" />
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="h-6 w-24 bg-slate-200 rounded-full" />
          <div className="h-10 w-32 bg-slate-200 rounded-xl" />
        </div>
      </div>
    </div>
  </div>
);

const ProductRecommendations = ({
  title,
  icon: Icon,
  products,
  loading,
  emptyMessage,
  hideWhenEmpty = false,
}) => {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const container = scrollRef.current;
    if (!container) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
  }, [products, loading]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return undefined;
    }

    const handleScroll = () => updateScrollState();
    const handleResize = () => updateScrollState();

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const scrollByCards = (direction) => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const firstCard = container.querySelector('[data-recommendation-card]');
    const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : container.clientWidth * 0.8;
    container.scrollBy({ left: direction * (cardWidth + 16) * 2, behavior: 'smooth' });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      scrollByCards(-1);
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      scrollByCards(1);
    }
  };

  const skeletonCards = useMemo(() => Array.from({ length: SKELETON_COUNT }), []);

  if (!loading && hideWhenEmpty && products.length === 0) {
    return null;
  }

  return (
    <section className="mb-10 sm:mb-12">
      <div className="flex items-end justify-between gap-4 mb-4 sm:mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 sm:gap-3">
            {Icon && <Icon size={18} className="text-[var(--brand-primary)] flex-shrink-0" />}
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-800 truncate">{title}</h2>
          </div>
          {!loading && !hideWhenEmpty && products.length === 0 && (
            <p className="text-sm sm:text-base text-slate-600 mt-2">{emptyMessage}</p>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByCards(-1)}
            disabled={!canScrollLeft || loading}
            className="btn-secondary inline-flex items-center justify-center h-10 w-10 rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={`Scroll ${title} left`}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => scrollByCards(1)}
            disabled={!canScrollRight || loading}
            className="btn-secondary inline-flex items-center justify-center h-10 w-10 rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={`Scroll ${title} right`}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory outline-none"
        aria-label={title}
      >
        {loading && skeletonCards.map((_, index) => <SkeletonCard key={`skeleton-${index}`} />)}

        {!loading && products.map((product) => (
          <div key={product._id} data-recommendation-card className="flex-none w-[82vw] sm:w-[46vw] lg:w-[23%] snap-start">
            <ProductCard product={product} actionMode="view" />
          </div>
        ))}
      </div>

    </section>
  );
};

export default ProductRecommendations;
