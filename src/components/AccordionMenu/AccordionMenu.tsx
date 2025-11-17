import { ChevronDown, Disc3 } from 'lucide-react';
import React, { useState } from 'react';
import styles from './AccordionMenu.module.css'; // Import the CSS module


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
  onItemDragStart?: (event: React.DragEvent, itemId: string) => void;
}

const AccordionMenu: React.FC<AccordionMenuProps> = ({
  categories,
  selectedItemId,
  onItemSelect,
  onMenuClick,
  title = 'Menu',
  defaultExpanded = true,
  onItemDragStart,
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
    <div className={styles.accordionMenu} onClick={onMenuClick}>
      <h3 className={styles.title}>{title}</h3>
      {Object.entries(normalizedCategories).map(([category, items]) => (
        <div key={category} className={styles.categorySection}>
          <button
            className={styles.categoryButton}
            onClick={() => toggleCategory(category)}
          >
            <div className={styles.categoryButtonContent}>
                <ChevronDown
                  className={`${styles.chevronIcon} ${expandedCategories[category] ? "" : styles.chevronIconCollapsed}`}
                />
                <span className={styles.categoryName} title={category}>{category}</span>
            </div>
          </button>
          {expandedCategories[category] && (
            <div className={styles.itemsContainer}>
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemSelect(item.id)}
                  onDragStart={(e) => {
                    if (onItemDragStart) {
                        onItemDragStart(e, item.id);
                    } else {
                      e.dataTransfer.setData('text/plain', item.id);
                    }
                  }}
                  draggable={!!onItemDragStart}
                  className={`${styles.item} ${item.id === selectedItemId ? styles.selectedItem : ''} ${onItemDragStart ? styles.draggableItem : ''}`}
                  title={item.name}
                >
                  <div className={styles.itemIcon}>{<Disc3 />}</div>
                  <span className={styles.itemName}>{item.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AccordionMenu; 