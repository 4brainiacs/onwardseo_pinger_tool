import React from 'react';
import { CheckSquare, Square, MinusSquare } from 'lucide-react';
import { PING_SERVICES, getServicesByCategory } from '../services/pingServices';
import type { CategoryType } from '../types';

interface CategoryFilterProps {
  selectedServices: Set<string>;
  onServiceChange: (services: Set<string>) => void;
}

const ALL_CATEGORIES: CategoryType[] = ['Search Engines', 'Blog Networks'];

export function CategoryFilter({ selectedServices, onServiceChange }: CategoryFilterProps) {
  const allServiceNames = PING_SERVICES.map(s => s.name);
  const allSelected = selectedServices.size === allServiceNames.length;
  const noneSelected = selectedServices.size === 0;

  /**
   * Get category selection state
   * Returns: 'all' | 'some' | 'none'
   */
  const getCategoryState = (category: CategoryType): 'all' | 'some' | 'none' => {
    const servicesInCategory = getServicesByCategory(category);
    const selectedInCategory = servicesInCategory.filter(s => selectedServices.has(s.name));

    if (selectedInCategory.length === 0) return 'none';
    if (selectedInCategory.length === servicesInCategory.length) return 'all';
    return 'some';
  };

  /**
   * Toggle all services on/off
   */
  const handleToggleAll = () => {
    if (allSelected) {
      // Unselect all
      onServiceChange(new Set());
    } else {
      // Select all
      onServiceChange(new Set(allServiceNames));
    }
  };

  /**
   * Toggle all services in a category
   */
  const handleToggleCategory = (category: CategoryType) => {
    const servicesInCategory = getServicesByCategory(category);
    const serviceNamesInCategory = servicesInCategory.map(s => s.name);
    const categoryState = getCategoryState(category);

    const newServices = new Set(selectedServices);

    if (categoryState === 'all') {
      // Unselect all services in this category
      serviceNamesInCategory.forEach(name => newServices.delete(name));
    } else {
      // Select all services in this category
      serviceNamesInCategory.forEach(name => newServices.add(name));
    }

    onServiceChange(newServices);
  };

  /**
   * Toggle individual service
   */
  const handleToggleService = (serviceName: string) => {
    const newServices = new Set(selectedServices);

    if (newServices.has(serviceName)) {
      newServices.delete(serviceName);
    } else {
      newServices.add(serviceName);
    }

    onServiceChange(newServices);
  };

  /**
   * Render checkbox icon based on state
   */
  const renderCheckbox = (state: 'all' | 'some' | 'none') => {
    switch (state) {
      case 'all':
        return <CheckSquare className="h-4 w-4 text-blue-600 flex-shrink-0" />;
      case 'some':
        return <MinusSquare className="h-4 w-4 text-blue-600 flex-shrink-0" />;
      case 'none':
        return <Square className="h-4 w-4 flex-shrink-0" />;
    }
  };

  return (
    <div className="w-full max-w-4xl mb-3">
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        {/* All Categories Toggle */}
        <button
          onClick={handleToggleAll}
          className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 px-2.5 py-2 rounded hover:bg-gray-50 w-full min-h-[40px] touch-manipulation"
        >
          {renderCheckbox(allSelected ? 'all' : noneSelected ? 'none' : 'some')}
          <span className="font-medium">All Categories</span>
          <span className="text-xs text-gray-400 ml-auto">
            ({selectedServices.size}/{allServiceNames.length} services)
          </span>
        </button>

        {/* Divider */}
        <div className="border-t border-gray-100 my-2" />

        {/* Categories */}
        <div className="mb-2">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide px-2.5 mb-1">
            Categories
          </div>
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-1">
            {ALL_CATEGORIES.map(category => {
              const categoryState = getCategoryState(category);
              const servicesInCategory = getServicesByCategory(category);
              const selectedCount = servicesInCategory.filter(s => selectedServices.has(s.name)).length;

              return (
                <button
                  key={category}
                  onClick={() => handleToggleCategory(category)}
                  aria-checked={categoryState === 'all'}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-2.5 py-2 rounded hover:bg-gray-50 w-full min-h-[40px] touch-manipulation"
                >
                  {renderCheckbox(categoryState)}
                  <span className="truncate">{category}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    ({selectedCount}/{servicesInCategory.length})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 my-2" />

        {/* Individual Services */}
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide px-2.5 mb-1">
            Services
          </div>
          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-1">
            {PING_SERVICES.map(service => {
              const isSelected = selectedServices.has(service.name);

              return (
                <button
                  key={service.name}
                  onClick={() => handleToggleService(service.name)}
                  aria-checked={isSelected}
                  title={service.description}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-2.5 py-2 rounded hover:bg-gray-50 w-full min-h-[40px] touch-manipulation"
                >
                  {isSelected ? (
                    <CheckSquare className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  ) : (
                    <Square className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span className="truncate text-left">
                    {service.name}
                    <span className="text-xs text-gray-400 ml-1">
                      ({service.category === 'Search Engines' ? 'SE' : 'BN'})
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
