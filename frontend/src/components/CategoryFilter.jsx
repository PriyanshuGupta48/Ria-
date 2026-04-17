import React from 'react';

const categories = ['All', 'Gifts', 'Keychains', 'Decorations', 'Accessories', 'Apparel'];

const CategoryFilter = ({ selectedCategory, onCategoryChange }) => {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 mb-6 sm:mb-8 overflow-x-auto">
      {categories.map(category => (
        <button
          key={category}
          onClick={() => onCategoryChange(category)}
          className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-full font-semibold text-sm sm:text-base transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
            selectedCategory === category
              ? 'text-white shadow-lg'
              : 'bg-white text-slate-700 hover:bg-orange-50 border shadow-sm'
          }`}
          style={
            selectedCategory === category
              ? { background: 'linear-gradient(135deg, #e27b5f 0%, #e99372 100%)' }
              : { borderColor: 'var(--border-soft)' }
          }
        >
          {category}
        </button>
      ))}
    </div>
  );
};

export default CategoryFilter;