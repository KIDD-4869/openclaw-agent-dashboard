import React from 'react';

const FilterBar = React.memo(function FilterBar({ categories, currentFilter, onFilter }) {
  return (
    <div className="filter-bar">
      {categories.map(fc => (
        <span
          key={fc.key || '__all__'}
          className={'filter-pill' + (currentFilter === fc.key ? ' active' : '')}
          onClick={() => onFilter(fc.key)}
        >
          {fc.label}
        </span>
      ))}
    </div>
  );
});

export default FilterBar;
