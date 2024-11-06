import React from 'react';
import { CheckSquare, Square, CheckSquare2 } from 'lucide-react';
import type { CategoryType } from '../types';

interface CategoryFilterProps {
  selectedCategories: Set<CategoryType>;
  onCategoryChange: (categories: Set<CategoryType>) => void;
}

export function CategoryFilter({ selectedCategories, onCategoryChange }: CategoryFilterProps) {
  const allSelected = selectedCategories.size === 7; // Total number of categories
  const someSelected = selectedCategories.size > 0 && !allSelected;

  const handleToggleAll = () => {
    if (allSelected) {
      onCategoryChange(new Set(['Global Services']));
    } else {
      onCategoryChange(new Set([
        'Global Services',
        'Search Engine Services',
        'RSS Services',
        'Blog Directory Services',
        'Asian Services',
        'European Services',
        'Blog Platform Services'
      ]));
    }
  };

  const handleToggleCategory = (category: CategoryType) => {
    const newCategories = new Set(selectedCategories);
    if (newCategories.has(category)) {
      if (newCategories.size > 1) {
        newCategories.delete(category);
      }
    } else {
      newCategories.add(category);
    }
    onCategoryChange(newCategories);
  };

  const categories: CategoryType[] = [
    'Global Services',
    'Search Engine Services',
    'RSS Services',
    'Blog Directory Services',
    'Asian Services',
    'European Services',
    'Blog Platform Services'
  ];

  return (
    <div className="w-full max-w-4xl mb-3">
      <div className="bg-white rounded-lg border border-gray-200 p-2.5">
        <button
          onClick={handleToggleAll}
          className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 px-2.5 py-2 rounded hover:bg-gray-50 w-full min-h-[40px] touch-manipulation mb-2"
        >
          {allSelected ? (
            <CheckSquare className="h-4 w-4 text-blue-600" />
          ) : someSelected ? (
            <CheckSquare2 className="h-4 w-4 text-blue-600" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          <span className="font-medium">All Categories</span>
        </button>
        
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-1">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => handleToggleCategory(category)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-2.5 py-2 rounded hover:bg-gray-50 w-full min-h-[40px] touch-manipulation"
            >
              {selectedCategories.has(category) ? (
                <CheckSquare className="h-4 w-4 text-blue-600 flex-shrink-0" />
              ) : (
                <Square className="h-4 w-4 flex-shrink-0" />
              )}
              <span className="truncate">{category}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}