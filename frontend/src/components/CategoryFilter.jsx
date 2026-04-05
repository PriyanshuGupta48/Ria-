import React from 'react';

const categories = ['All', 'Gifts', 'Keychains', 'Decorations', 'Accessories', 'Apparel'];

const CategoryFilter = ({ selectedCategory, onCategoryChange }) => {
  return (
    <div className="flex flex-wrap gap-3 mb-8">
      {categories.map(category => (
        <button
          key={category}
          onClick={() => onCategoryChange(category)}
          className={`px-5 py-2 rounded-full font-semibold transition-all duration-200 ${
            selectedCategory === category
              ? 'bg-rose-300 text-white shadow-lg shadow-rose-200'
              : 'bg-white text-slate-700 hover:bg-rose-50 border border-rose-100 shadow-sm'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
};

export default CategoryFilter;