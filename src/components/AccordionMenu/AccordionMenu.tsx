import { ChevronDown, Disc3, SquareIcon } from 'lucide-react';
import React, { useState, useEffect } from 'react';

// Define types for the accordion menu items
export interface AccordionItem {
  id: string;
  name: string;
}

export interface AccordionCategory {
  name: string;
  items: AccordionItem[];
}

interface AccordionMenuProps {
  categories: Record<string, AccordionItem[]> | AccordionCategory[];
  selectedItemId: string | null;
  onItemSelect: (itemId: string) => void;
  onMenuClick?: () => void;
  title?: string;
  defaultExpanded?: boolean;
}

const AccordionMenu: React.FC<AccordionMenuProps> = ({
  categories,
  selectedItemId,
  onItemSelect,
  onMenuClick,
  title = 'Menu',
  defaultExpanded = true,
}) => {
  // Convert categories to standardized format for internal use
  const normalizedCategories = Array.isArray(categories)
    ? categories.reduce((acc, category) => {
        acc[category.name] = category.items;
        return acc;
      }, {} as Record<string, AccordionItem[]>)
    : categories;

  // State for expanded categories
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() =>
    Object.keys(normalizedCategories).reduce((acc, category) => {
      acc[category] = defaultExpanded;
      return acc;
    }, {} as Record<string, boolean>)
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const handleItemSelect = (itemId: string) => {
    onItemSelect(itemId);
  };

  return (
    <div className="accordion-menu text-white" onClick={onMenuClick}>
      <h3>{title}</h3>
      {Object.entries(normalizedCategories).map(([category, items]) => (
        <div key={category} className="category-section">
            <button
                    className="w-full flex items-center justify-between p-3 hover:bg-[#333] transition-colors"
                    onClick={() => toggleCategory(category)}
                  >
                <div className="flex items-center">
                    <ChevronDown
                    className={`h-4 w-4 mr-2 transition-transform ${expandedCategories[category] ? "" : "-rotate-90"}`}
                    />
                    <span className="font-medium">{category}</span>
                </div>
                </button>
          {expandedCategories[category] && (
            <div className="pl-4 space-y-1 py-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemSelect(item.id)}
                  className="mx-2 p-2 pl-4 hover:bg-[#333] cursor-pointer transition-all rounded-lg flex items-center group"
                >
                  <div className="mr-2 text-gray-400">{<Disc3 className="h-4 w-4"/>}</div>
                  <span className="text-sm group-hover:text-white transition-colors">{item.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <style jsx>{`
        .accordion-menu {
          width: 16rem;
          display: flex;
          flex-direction: column;
          background-color: #252525;
          border-right: 1px solid #3a3a3a;
          height: 100%;
          overflow-y: auto;
          box-sizing: border-box;
        }
        .accordion-menu > h3 {
          margin: 0;
          padding: 0.75rem;
          border-bottom: 1px solid #3a3a3a;
          font-size: 1.125rem;
          font-weight: 600;
          color: #e0e0e0;
        }
        .category-section h4 {
          margin: 0;
          padding: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          font-weight: 500;
          color: #e0e0e0;
          transition: background-color 0.2s;
        }
        .category-section h4:hover {
          background-color: #333333;
        }
        .item-list {
          list-style: none;
          padding-left: 1rem;
          margin: 0;
        }
        .menu-item {
          display: flex;
          align-items: center;
          margin: 0.25rem 0;
          padding: 0.5rem 0.5rem 0.5rem 1rem;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: background-color 0.2s, color 0.2s;
          color: #cbd5e1;
        }
        .menu-item:hover {
          background-color: #333333;
          color: #ffffff;
        }
        .menu-item.selected {
          background-color: #2d3540;
          font-weight: 600;
          color: #ffffff;
        }
      `}</style>
    </div>
  );
};

export default AccordionMenu; 