// Global variables to store file, data, and color scales
let file = null;
let csvFileData = null;
let globalColorScales = null;
let gridSummaryData = null; // Add this to store the grid summary data
let vsmData = null;
let activeFilters = new Map();
let activeNumericalFilters = {
  column: null,
  range: null
};
let selectedColumns = new Set(); // Store selected column names
let allColumns = []; // Store all column names
// Global variable to store selected empty cells
let selectedEmptyCells = new Set();

// Add click event listener to the search tab
document.querySelector('.search-tab').addEventListener('click', function() {
  document.getElementById('csvFileInput').click();
});

function generateColorScales(data) {
  if (!data || !data.columns) {
    console.error('Invalid data provided to generateColorScales');
    return {};
  }

  const colorScales = {};
  const columns = data.columns;

  columns.forEach(col => {
    try {
      const values = data.map(row => row[col]).filter(value => value !== null && value !== '');
      
      // Check if we have any valid values
      if (values.length === 0) {
        console.warn(`No valid values found for column: ${col}`);
        colorScales[col] = {
          type: 'categorical',
          scale: d3.scaleOrdinal().range(['#cccccc'])
        };
        return;
      }

      const isNumeric = values.every(value => !isNaN(value));

      if (isNumeric) {
        const numericValues = values.map(Number);
        const min = d3.min(numericValues);
        const max = d3.max(numericValues);
        
        colorScales[col] = {
          type: 'numerical',
          scale: d3.scaleLinear()
            .domain([min, max])
            .range(['#fdd49e', '#7f0000'])
            .clamp(true) // Clamp values outside the domain
        };
      } else {
        const valueCounts = values.reduce((acc, value) => {
          acc[value] = (acc[value] || 0) + 1;
          return acc;
        }, {});

        const topValues = Object.entries(valueCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(d => d[0]);

        colorScales[col] = {
          type: 'categorical',
          scale: d3.scaleOrdinal()
            .domain(topValues)
            .range(['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c'])
            .unknown('#cccccc')
        };
      }
    } catch (error) {
      console.error(`Error generating color scale for column ${col}:`, error);
      // Provide a fallback color scale
      colorScales[col] = {
        type: 'categorical',
        scale: d3.scaleOrdinal().range(['#cccccc'])
      };
    }
  });

  return colorScales;
}

// Modify file input handler to immediately visualize CSV
document.getElementById('csvFileInput').addEventListener('change', async function(event) {
  file = event.target.files[0];
  if (file) {
    try {
      const reader = new FileReader();
      
      reader.onload = async function(e) {
        csvFileData = e.target.result;
        try {
          const data = d3.csvParse(csvFileData);
          createColumnSelector(data.columns);
          globalColorScales = generateColorScales(data);
          
          document.querySelector('.search-tab label').innerHTML = 
            '<span class="magnifier-icon">&#128269;</span>' + file.name;
          
          // Update visualizations
          createLegends(globalColorScales);
          initializeSortingControls(data);
          visualizeCSVData(csvFileData);
          await fetchVSMData(csvFileData);
          
          // Update grid summary if it's active
          if (document.getElementById('gridSummaryButton').classList.contains('active')) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('rowClusters', document.getElementById('rowClusters').value);
            formData.append('colClusters', document.getElementById('colClusters').value);

            const response = await fetch('/get_clusters', {
              method: 'POST',
              body: formData
            });
            const clusterData = await response.json();
            if (!clusterData.error) {
              visualizeGridSummary(clusterData);
            }
          }
        } catch (error) {
          console.error('Error processing CSV:', error);
          alert('Error processing CSV file. Please check the file format.');
        }
      };

      reader.readAsText(file);
    } catch (error) {
      console.error('Error handling file:', error);
      alert('Error handling the file. Please try again.');
    }
  }
});

// Update slider values display
document.getElementById('rowClusters').addEventListener('input', function() {
  document.getElementById('rowClustersValue').textContent = this.value;
});

document.getElementById('colClusters').addEventListener('input', function() {
  document.getElementById('colClustersValue').textContent = this.value;
});


// Update the Grid Summary button handler to use filtered data
document.getElementById('gridSummaryButton').addEventListener('click', function() {
  if (csvFileData) {
    // Get the currently filtered data
    const data = d3.csvParse(csvFileData);
    
    // Apply both categorical and numerical filters
    const filteredData = data.filter(row => {
      // Check categorical filters
      const categoricalMatch = Array.from(activeFilters.entries()).every(([column, values]) => {
        const rowValue = row[column];
        return values.has(rowValue) || 
               (values.has('OTHER') && !globalColorScales[column].scale.domain().includes(rowValue));
      });
      
      // Check numerical filter if active
      let numericalMatch = true;
      if (activeNumericalFilters.column && activeNumericalFilters.range) {
        const value = +row[activeNumericalFilters.column];
        numericalMatch = value >= activeNumericalFilters.range[0] && 
                        value <= activeNumericalFilters.range[1];
      }
      
      return categoricalMatch && numericalMatch;
    });

    // Filter columns
    const filteredColumns = Array.from(selectedColumns);
    const finalFilteredData = filteredData.map(row => {
      const newRow = {};
      filteredColumns.forEach(col => {
        if (row.hasOwnProperty(col)) {
          newRow[col] = row[col];
        }
      });
      return newRow;
    });

    // Convert to CSV
    const filteredCSV = d3.csvFormat(finalFilteredData);

    // Create form data with the filtered CSV
    const formData = new FormData();
    const filteredBlob = new Blob([filteredCSV], { type: 'text/csv' });
    formData.append('file', new File([filteredBlob], 'filtered.csv', { type: 'text/csv' }));
    formData.append('rowClusters', document.getElementById('rowClusters').value);
    formData.append('colClusters', document.getElementById('colClusters').value);

    fetch('/get_clusters', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        console.error('Error:', data.error);
      } else {
        visualizeGridSummary(data);
      }
    })
    .catch(error => {
      console.error('Error:', error);
    });
  } else {
    alert("Please upload a file using the search tab first.");
  }
});


function visualizeCSVData(csvData) {

  if (!csvData) {
    console.error('No CSV data provided');
    return;
  }

  try {
    const allRows = csvData.split('\n');
    let headers = allRows[0].split(',').map(h => h.trim());
    const expectedColumns = headers.length;
    
    let processedData = allRows.slice(1).map((row, rowIndex) => {
      const values = row.split(',').map(v => v.trim());
      const rowData = {
        _rowIndex: rowIndex,
      };
      
      headers.forEach((header, i) => {
        rowData[header] = values[i] || '';
        if (!values[i] || values[i].trim() === '') {
          if (!rowData._missingColumns) rowData._missingColumns = [];
          rowData._missingColumns.push(header);
        }
      });
      
      if (values.length > expectedColumns) {
        rowData._extraValues = values.slice(expectedColumns);
        rowData._extraValuesStartIndex = expectedColumns;
      }
      
      return rowData;
    });

    const rectSize = 8;
    const gap = 3;
    const columns = headers.filter(col => selectedColumns.has(col));

    if (!processedData.length || !columns.length) {
      console.error('No data or columns to visualize');
      return;
    }

    const container = document.querySelector('#visualizationContainer');
    d3.select(container).selectAll('svg').remove();

    const svg = d3.select(container).append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .style('overflow', 'auto');

    // Context menu for empty cells
    const emptyContextMenu = d3.select('body')
      .append('div')
      .attr('class', 'empty-cell-menu')
      .style('position', 'absolute')
      .style('display', 'none')
      .style('background', '#2c3e50')
      .style('border', '1px solid #34495e')
      .style('padding', '5px')
      .style('border-radius', '3px')
      .style('z-index', '1000');

    // Add menu items
    emptyContextMenu.selectAll('.menu-item')
      .data(['Delete Column', 'Delete Row', 'Impute Value'])
      .enter()
      .append('div')
      .attr('class', 'menu-item')
      .text(d => d)
      .style('padding', '5px 10px')
      .style('cursor', 'pointer')
      .style('color', 'white')
      .on('click', handleEmptyContextMenuClick);

    let selectedEmptyCells = new Set();
    let yPos = 20;
    let maxXPos = 0;

    function handleEmptyContextMenuClick(event, action) {
      emptyContextMenu.style('display', 'none');
      
      if (selectedEmptyCells.size === 0) return;
    
      const selectedCells = Array.from(selectedEmptyCells).map(id => {
        const [row, col] = id.split('-');
        return { row: parseInt(row), col };
      });
    
      // Parse the current CSV data
      const data = d3.csvParse(csvFileData);
      const headers = data.columns;
    
      // Prevent immediate execution for impute value
      if (action === 'Impute Value') {
        const column = selectedCells[0].col;
        const colorScale = globalColorScales[column];
        
        // Create color picker overlay
        const overlay = d3.select('body')
          .append('div')
          .style('position', 'fixed')
          .style('top', '0')
          .style('left', '0')
          .style('width', '100%')
          .style('height', '100%')
          .style('background', 'rgba(0,0,0,0.8)')
          .style('z-index', '2000');
    
        const picker = overlay
          .append('div')
          .style('position', 'absolute')
          .style('top', '50%')
          .style('left', '50%')
          .style('transform', 'translate(-50%, -50%)')
          .style('background', 'white')
          .style('padding', '20px')
          .style('border-radius', '5px');
    
        if (colorScale.type === 'numerical') {
          const scaleWidth = 300;
          const scaleHeight = 40;
          const domain = colorScale.scale.domain();
          const gradientScale = d3.scaleLinear()
            .domain(domain)
            .range([0, scaleWidth]);
    
          // Use a unique ID for the gradient
          const gradientId = `color-gradient-${Date.now()}`;
          
          const gradient = picker.append('svg')
            .attr('width', scaleWidth)
            .attr('height', scaleHeight + 20) // Add space for labels
            .append('defs')
            .append('linearGradient')
            .attr('id', gradientId)
            .attr('x1', '0%')
            .attr('x2', '100%');
    
          // Use the column-specific color scale for the gradient stops
          const stops = d3.range(0, 1.1, 0.1).map(t => {
            const value = d3.quantile(domain, t);
            return {
              offset: t * 100 + '%',
              color: colorScale.scale(value),
              value: value
            };
          });
    
          gradient.selectAll('stop')
            .data(stops)
            .enter()
            .append('stop')
            .attr('offset', d => d.offset)
            .attr('stop-color', d => d.color);
    
          const svg = picker.select('svg');
          
          svg.append('rect')
            .attr('width', scaleWidth)
            .attr('height', scaleHeight)
            .style('fill', `url(#${gradientId})`)
            .on('click', function(event) {
              const x = event.offsetX;
              const value = gradientScale.invert(x);
              
              // Update the actual data with the imputed value
              selectedCells.forEach(cell => {
                const rowData = data[cell.row];
                if (rowData) {
                  rowData[cell.col] = value.toFixed(2);
                }
              });
              
              // Update the CSV file data
              csvFileData = d3.csvFormat(data);
              
              overlay.remove();
              selectedEmptyCells.clear();
              
              // Refresh visualizations with the updated data
              visualizeCSVData(csvFileData);
              if (document.getElementById('gridSummaryButton').classList.contains('active')) {
                updateGridSummary();
              }
            });
    
          // Add value labels
          svg.selectAll('.value-label')
            .data([stops[0], stops[stops.length - 1]])
            .enter()
            .append('text')
            .attr('class', 'value-label')
            .attr('x', (d, i) => i === 0 ? 0 : scaleWidth)
            .attr('y', scaleHeight + 15)
            .attr('text-anchor', (d, i) => i === 0 ? 'start' : 'end')
            .style('font-size', '12px')
            .text(d => d.value.toFixed(2));
    
        } else if (colorScale.type === 'categorical') {
          const categories = colorScale.scale.domain();
          
          picker.selectAll('.category')
            .data(categories)
            .enter()
            .append('div')
            .style('cursor', 'pointer')
            .style('padding', '5px')
            .style('margin', '5px')
            .style('background-color', d => colorScale.scale(d))
            .style('color', d => d3.lab(colorScale.scale(d)).l < 50 ? 'white' : 'black')
            .text(d => d)
            .on('click', function(event, d) {
              // Update the actual data with the imputed value
              selectedCells.forEach(cell => {
                const rowData = data[cell.row];
                if (rowData) {
                  rowData[cell.col] = d;
                }
              });
              
              // Update the CSV file data
              csvFileData = d3.csvFormat(data);
              
              overlay.remove();
              selectedEmptyCells.clear();
              
              // Refresh visualizations with the updated data
              visualizeCSVData(csvFileData);
              if (document.getElementById('gridSummaryButton').classList.contains('active')) {
                updateGridSummary();
              }
            });
        }
        return;
      }
    
      switch(action) {
        case 'Delete Column':
          const columnsToDelete = new Set(selectedCells.map(cell => cell.col));
          
          // Filter out the columns to delete from the data
          const newHeaders = headers.filter(h => !columnsToDelete.has(h));
          const newData = data.map(row => {
            const newRow = {};
            newHeaders.forEach(header => {
              if (!columnsToDelete.has(header)) {
                newRow[header] = row[header];
              }
            });
            return newRow;
          });
          
          // Update the CSV file data
          csvFileData = d3.csvFormat(newData);
          
          // Update selected columns
          columnsToDelete.forEach(col => selectedColumns.delete(col));
          break;
    
        case 'Delete Row':
          const rowsToDelete = new Set(selectedCells.map(cell => cell.row));
          
          // Filter out the rows to delete
          const filteredData = data.filter((_, index) => !rowsToDelete.has(index));
          
          // Update the CSV file data
          csvFileData = d3.csvFormat(filteredData);
          break;
      }
    
      // Refresh visualizations with the updated data
      visualizeCSVData(csvFileData);
      if (document.getElementById('gridSummaryButton').classList.contains('active')) {
        updateGridSummary();
      }
      
      // Clear selection
      selectedEmptyCells.clear();
    }
    


    // Draw cells
    processedData.forEach((row) => {
      let xPos = 10;
      
      columns.forEach((col) => {
        const value = row[col];
        const isMissing = !value || value.trim() === '';
        const colorScale = globalColorScales[col];

        let color = isMissing ? '#ff0000' : 
          colorScale.type === 'numerical' ? 
            (!isNaN(+value) ? colorScale.scale(+value) : '#ff0000') :
            colorScale.scale(value);

        const rect = svg.append('rect')
          .attr('x', xPos)
          .attr('y', yPos)
          .attr('width', rectSize)
          .attr('height', rectSize)
          .attr('fill', color)
          .attr('class', 'grid-cell')
          .attr('data-column', col)
          .attr('data-row', row._rowIndex);

        if (isMissing) {
          const cellId = `${row._rowIndex}-${col}`;
          
          rect.style('stroke', selectedEmptyCells.has(cellId) ? '#00ff00' : '#880000')
              .style('stroke-width', '1px')
              .style('cursor', 'pointer')
              .on('click', function(event) {
                if (event.ctrlKey || event.metaKey) {
                  if (selectedEmptyCells.has(cellId)) {
                    selectedEmptyCells.delete(cellId);
                    d3.select(this).style('stroke', '#880000');
                  } else {
                    selectedEmptyCells.add(cellId);
                    d3.select(this).style('stroke', '#00ff00');
                  }
                } else {
                  selectedEmptyCells.clear();
                  svg.selectAll('.grid-cell').style('stroke', '#880000');
                  selectedEmptyCells.add(cellId);
                  d3.select(this).style('stroke', '#00ff00');
                }
              })
              .on('contextmenu', function(event) {
                event.preventDefault();
                if (selectedEmptyCells.size > 0) {
                  emptyContextMenu
                    .style('display', 'block')
                    .style('left', (event.pageX + 5) + 'px')
                    .style('top', (event.pageY + 5) + 'px');
                }
              });
        }

        rect.append('title')
           .text(`${col}: ${isMissing ? 'Missing value' : value}`);

        xPos += rectSize + gap;
      });

      maxXPos = Math.max(maxXPos, xPos);
      yPos += rectSize + gap;
    });

    // Hide context menu when clicking outside
    d3.select('body').on('click', function(event) {
      if (!event.target.closest('.empty-cell-menu')) {
        emptyContextMenu.style('display', 'none');
      }
    });

    if (maxXPos > 0) {
      svg.attr('width', maxXPos + 10)
         .attr('height', yPos);
    }

  } catch (error) {
    console.error('Error visualizing CSV data:', error);
  }
}

// Helper function to update grid summary
function updateGridSummary() {
  const formData = new FormData();
  const blob = new Blob([csvFileData], { type: 'text/csv' });
  formData.append('file', new File([blob], 'updated.csv', { type: 'text/csv' }));
  formData.append('rowClusters', document.getElementById('rowClusters').value);
  formData.append('colClusters', document.getElementById('colClusters').value);

  fetch('/get_clusters', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    if (!data.error) {
      visualizeGridSummary(data);
    }
  })
  .catch(error => console.error('Error:', error));
}

function convertProcessedDataToCSV(data, headers) {
  const csvRows = [headers.join(',')];
  
  data.forEach(row => {
    const values = headers.map(header => row[header] || '');
    if (row._extraValues) {
      values.push(...row._extraValues);
    }
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

// Store the original data order for reference
let originalDataOrder = null;
let currentClusteredData = null;

// function synchronizeGridViews(clusterData) {
//   if (!csvFileData || !clusterData || !clusterData.blocks) return;
  
//   const originalData = d3.csvParse(csvFileData);
//   currentClusteredData = clusterData;
  
//   // Store original order if not already stored
//   if (!originalDataOrder) {
//     originalDataOrder = {
//       rows: originalData.map((_, i) => i),
//       columns: originalData.columns.slice()
//     };
//   }

//   // Get unique row clusters
//   const rowClusters = [...new Set(Object.keys(clusterData.blocks).map(key => key.split(',')[0]))];
  
//   // Create a map of ID to row data
//   const idToRow = new Map();
//   originalData.forEach(row => {
//     idToRow.set(row.ID.toString(), row);
//   });

//   // Build ordered rows based on block data
//   let orderedRows = [];
//   let processedIds = new Set();
  
//   // Process each row cluster in order
//   rowClusters.forEach(rowCluster => {
//     // Get all blocks for this row cluster
//     const clusterBlocks = Object.entries(clusterData.blocks)
//       .filter(([key]) => key.split(',')[0] === rowCluster)
//       .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

//     // Process each block
//     clusterBlocks.forEach(([_, block]) => {
//       // Get IDs from this block's data
//       block.data.forEach(rowData => {
//         const id = rowData[0].toString(); // First column is ID
//         if (!processedIds.has(id)) {
//           const originalRow = idToRow.get(id);
//           if (originalRow) {
//             orderedRows.push(originalRow);
//             processedIds.add(id);
//           }
//         }
//       });
//     });
//   });

//   // Add any remaining unprocessed rows
//   originalData.forEach(row => {
//     if (!processedIds.has(row.ID.toString())) {
//       orderedRows.push(row);
//     }
//   });

//   // Get ordered columns
//   const columnOrder = new Set();
//   Object.values(clusterData.blocks).forEach(block => {
//     if (block.columns) {
//       block.columns.forEach(col => columnOrder.add(col));
//     }
//   });

//   // Create reordered CSV
//   const reorderedCsv = d3.csvFormat(orderedRows.map(row => {
//     const newRow = {};
//     Array.from(columnOrder).forEach(col => {
//       newRow[col] = row.hasOwnProperty(col) ? row[col] : '';
//     });
//     return newRow;
//   }));

//   // Update visualizations with reordered data
//   visualizeCSVData(reorderedCsv);
  
//   // Add visual cluster boundaries
//   addClusterBoundaries(rowClusters, orderedRows.length);
// }

function synchronizeGridViews(clusterData) {
  if (!csvFileData || !clusterData || !clusterData.blocks) return;
  
  const originalData = d3.csvParse(csvFileData);
  currentClusteredData = clusterData;
  
  // Store original order if not already stored
  if (!originalDataOrder) {
    originalDataOrder = {
      rows: originalData.map((_, i) => i),
      columns: originalData.columns.slice()
    };
  }

  // Get unique row clusters
  const rowClusters = [...new Set(Object.keys(clusterData.blocks).map(key => key.split(',')[0]))];
  
  // Build ordered rows based on block data
  let orderedRows = [];
  let processedRows = new Set();
  
  // Process each row cluster in order
  rowClusters.forEach(rowCluster => {
    // Get all blocks for this row cluster
    const clusterBlocks = Object.entries(clusterData.blocks)
      .filter(([key]) => key.split(',')[0] === rowCluster)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

    // Process each block
    clusterBlocks.forEach(([_, block]) => {
      // Handle the case where block.data might be undefined or empty
      if (!block.data || !Array.isArray(block.data)) return;
      
      block.data.forEach((rowData, rowIndex) => {
        // Skip if we've already processed this row
        if (processedRows.has(rowIndex)) return;
        
        // Find corresponding row in original data
        if (rowIndex < originalData.length) {
          orderedRows.push(originalData[rowIndex]);
          processedRows.add(rowIndex);
        }
      });
    });
  });

  // Add any remaining unprocessed rows
  originalData.forEach((row, index) => {
    if (!processedRows.has(index)) {
      orderedRows.push(row);
    }
  });

  // Get ordered columns from the blocks
  const columnOrder = new Set();
  Object.values(clusterData.blocks).forEach(block => {
    if (block.columns && Array.isArray(block.columns)) {
      block.columns.forEach(col => columnOrder.add(col));
    }
  });

  // If no columns were found in blocks, use all available columns
  if (columnOrder.size === 0) {
    originalData.columns.forEach(col => columnOrder.add(col));
  }

  // Create reordered CSV
  const reorderedCsv = d3.csvFormat(orderedRows.map(row => {
    const newRow = {};
    Array.from(columnOrder).forEach(col => {
      newRow[col] = row.hasOwnProperty(col) ? row[col] : '';
    });
    return newRow;
  }));

  // Update visualizations with reordered data
  visualizeCSVData(reorderedCsv);
  
  // Add visual cluster boundaries
  addClusterBoundaries(rowClusters, orderedRows.length);
}

function addClusterBoundaries(rowClusters, totalRows) {
  const container = document.querySelector('#visualizationContainer');
  const svg = d3.select(container).select('svg');
  if (!svg.empty()) {
    // Remove any existing boundaries
    svg.selectAll('.cluster-boundary').remove();
    
    // Get the dimensions of the visualization
    const rectSize = 8;
    const gap = 3;
    
    // Add horizontal lines between row clusters
    let currentRowCount = 0;
    rowClusters.forEach((_, index) => {
      if (index < rowClusters.length - 1) {
        const rowsInCluster = Math.floor(totalRows / rowClusters.length);
        currentRowCount += rowsInCluster;
        
        svg.append('line')
          .attr('class', 'cluster-boundary')
          .attr('x1', 0)
          .attr('y1', currentRowCount * (rectSize + gap))
          .attr('x2', svg.attr('width'))
          .attr('y2', currentRowCount * (rectSize + gap))
          .style('stroke', '#ffffff')
          .style('stroke-width', 1)
          .style('stroke-dasharray', '5,5');
      }
    });
  }
}

function resetToOriginalOrder() {
  if (!csvFileData || !originalDataOrder) return;
  
  const data = d3.csvParse(csvFileData);
  
  // Reorder back to original
  const reorderedData = originalDataOrder.rows.map(i => data[i]);
  
  // Create CSV string with original order
  const originalOrderCsv = d3.csvFormat(reorderedData.map(row => {
    const newRow = {};
    originalDataOrder.columns.forEach(col => {
      if (row.hasOwnProperty(col)) {
        newRow[col] = row[col];
      }
    });
    return newRow;
  }));

  // Update visualization with original order
  visualizeCSVData(originalOrderCsv);
  
  // Remove cluster boundaries
  const container = document.querySelector('#visualizationContainer');
  const svg = d3.select(container).select('svg');
  if (!svg.empty()) {
    svg.selectAll('.cluster-boundary').remove();
  }
  
  currentClusteredData = null;
}

// Add event listener to Grid Summary button to handle toggling
document.getElementById('gridSummaryButton').addEventListener('click', function() {
  const isActive = this.classList.toggle('active');
  
  if (!isActive && currentClusteredData) {
    // Reset to original order when deactivating grid summary
    resetToOriginalOrder();
  } else if (isActive && currentClusteredData) {
    // Reapply clustering when reactivating
    synchronizeGridViews(currentClusteredData);
  }
});

function visualizeGridSummary(data) {
  gridSummaryData = data;
  synchronizeGridViews(data);
  
  const container = d3.select('#gridSummaryButton').node().parentNode;
  d3.select(container).selectAll('svg').remove();

  const containerHeight = container.getBoundingClientRect().height;
  const containerWidth = container.getBoundingClientRect().width;
  const buttonHeight = d3.select('#gridSummaryButton').node().getBoundingClientRect().height;
  const availableHeight = containerHeight - buttonHeight - 10;
  const availableWidth = containerWidth - 20;

  const svg = d3.select(container).append('svg')
    .attr('width', containerWidth)
    .attr('height', containerHeight);

  const blocks = data.blocks;
  const rowClusters = [...new Set(Object.keys(blocks).map(key => key.split(',')[0]))];
  
  // Calculate dimensions
  let totalLogicalHeight = 0;
  const clusterHeights = {};
  const clusterWidths = {};
  const blocksPerCluster = {};
  
  rowClusters.forEach(cluster => {
    const clusterBlocks = Object.entries(blocks).filter(([key]) => key.split(',')[0] === cluster);
    const maxHeight = Math.max(...clusterBlocks.map(([_, block]) => block.data.length));
    clusterHeights[cluster] = maxHeight;
    totalLogicalHeight += maxHeight;
    const totalWidth = clusterBlocks.reduce((sum, [_, block]) => sum + block.data[0].length, 0);
    clusterWidths[cluster] = totalWidth;
    blocksPerCluster[cluster] = clusterBlocks.length;
  });

  const maxClusterLogicalWidth = Math.max(...Object.values(clusterWidths));
  const totalVerticalGaps = (rowClusters.length - 1) * 3;
  const heightScaleFactor = (availableHeight - totalVerticalGaps) / totalLogicalHeight;
  
  const sameClusterGap = 1;
  const differentClusterGap = 6;

  let yPos = buttonHeight + 12;
  const clusterPositions = {};

  // Group and sort blocks by row and column clusters
  const groupedBlocks = {};
  Object.entries(blocks).forEach(([key, value]) => {
    const [rowCluster, colCluster] = key.split(',');
    const clusterKey = `${rowCluster},${colCluster}`;
    if (!groupedBlocks[clusterKey]) {
      groupedBlocks[clusterKey] = [];
    }
    groupedBlocks[clusterKey].push({ key, value });
  });

  // Sort blocks within each cluster group to ensure consistent ordering
  Object.values(groupedBlocks).forEach(blockGroup => {
    blockGroup.sort((a, b) => {
      const typeA = a.key.split(',')[3];
      const typeB = b.key.split(',')[3];
      // Ensure numerical blocks always come before categorical blocks
      if (typeA === typeB) return 0;
      return typeA === 'numerical' ? -1 : 1;
    });
  });

  function getBlockColor(block, blockType, columns) {
    const columnColors = columns.map((col, colIndex) => {
      const colorScale = globalColorScales[col];
      if (!colorScale) return null;
  
      if (blockType === 'numerical' && colorScale.type === 'numerical') {
        let sum = 0;
        let count = 0;
        block.data.forEach(row => {
          const value = row[colIndex];
          if (!isNaN(value) && value !== '') {
            sum += Number(value);
            count++;
          }
        });
        
        if (count > 0) {
          const mean = sum / count;
          return colorScale.scale(mean);
        }
        return null;
      } else if (blockType === 'categorical' && colorScale.type === 'categorical') {
        const valueCounts = {};
        block.data.forEach(row => {
          const value = row[colIndex];
          if (value !== '') {
            valueCounts[value] = (valueCounts[value] || 0) + 1;
          }
        });
        const mostFrequent = Object.entries(valueCounts)
          .sort((a, b) => b[1] - a[1])[0];
        return mostFrequent ? colorScale.scale(mostFrequent[0]) : null;
      }
      return null;
    }).filter(color => color !== null);
  
    if (columnColors.length > 0) {
      return columnColors[0];
    }
    
    return blockType === 'numerical' ? '#fdd49e' : '#a6cee3';
  }

  // Visualize blocks
  Object.entries(groupedBlocks).forEach(([clusterKey, blockGroup]) => {
    const [rowCluster, colCluster] = clusterKey.split(',');
    const scaledHeight = clusterHeights[rowCluster] * heightScaleFactor;

    if (!clusterPositions[rowCluster]) {
      clusterPositions[rowCluster] = { x: 10, y: yPos };
      yPos += scaledHeight + differentClusterGap;
    }

    const totalGroupWidth = blockGroup.reduce((sum, { value }) => 
      sum + value.data[0].length * (availableWidth / maxClusterLogicalWidth), 0);
    
    let currentX = clusterPositions[rowCluster].x;
    let isFirstInGroup = true;

    blockGroup.forEach(({ key, value }) => {
      const [, , , blockType] = key.split(',');
      const block = value.data;
      const scaledWidth = block[0].length * (availableWidth / maxClusterLogicalWidth);

      if (!isFirstInGroup) {
        currentX += sameClusterGap;
      }

      const blockColor = getBlockColor(value, blockType, value.columns);

      const rect = svg.append('rect')
        .attr('x', currentX)
        .attr('y', clusterPositions[rowCluster].y)
        .attr('width', scaledWidth)
        .attr('height', scaledHeight)
        .attr('fill', blockColor)
        .attr('data-row-cluster', rowCluster)
        .attr('data-col-cluster', colCluster)
        .style('cursor', 'pointer')
        .on('click', function() {
          visualizeBlockDetails(block, blockType, value.columns);
        })
        .on('contextmenu', function(event) {
          event.preventDefault();
          showContextMenu(event, rowCluster, colCluster);
        });

      currentX += scaledWidth;
      isFirstInGroup = false;
    });

    clusterPositions[rowCluster].x = currentX + differentClusterGap;
  });
}

function showContextMenu(event, rowCluster, colCluster) {
  // Get the block type from the clicked element
  const clickedRect = d3.select(event.target);
  const blockData = gridSummaryData.blocks[`${rowCluster},${colCluster}`];
  
  // Remove any existing context menus
  d3.selectAll('.context-menu').remove();

  // Create context menu
  const contextMenu = d3.select('body')
    .append('div')
    .attr('class', 'context-menu')
    .style('left', event.pageX + 'px')
    .style('top', event.pageY + 'px');

  // Add menu items
  contextMenu.append('div')
    .attr('class', 'context-menu-item')
    .text('Delete Row Cluster')
    .on('click', () => {
      deleteRowCluster(rowCluster);
      contextMenu.remove();
    });

  // Find the block type of the clicked rectangle
  const clickedBlockKey = Object.keys(gridSummaryData.blocks).find(key => {
    const [r, c] = key.split(',');
    return r === rowCluster && c === colCluster;
  });
  const clickedBlockType = clickedBlockKey.split(',')[3];

  contextMenu.append('div')
    .attr('class', 'context-menu-item')
    .text(`Delete ${clickedBlockType.charAt(0).toUpperCase() + clickedBlockType.slice(1)} Columns`)
    .on('click', () => {
      deleteColumnClusterByType(colCluster, clickedBlockType);
      contextMenu.remove();
    });

  // Close menu when clicking outside
  d3.select('body').on('click.context-menu', function() {
    contextMenu.remove();
    d3.select('body').on('click.context-menu', null);
  });
}

function deleteColumnClusterByType(colCluster, blockType) {
  if (gridSummaryData && gridSummaryData.blocks) {
    // Filter out only blocks of the specified type in the specified column cluster
    const newBlocks = {};
    Object.entries(gridSummaryData.blocks).forEach(([key, value]) => {
      const [row, col, id, type] = key.split(',');
      // Keep the block if it's either:
      // 1. Not in the target column cluster, or
      // 2. In the target cluster but of a different type
      if (col !== colCluster || type !== blockType) {
        newBlocks[key] = value;
      }
    });
    gridSummaryData.blocks = newBlocks;
    visualizeGridSummary(gridSummaryData);
  }
}

// The original deleteRowCluster function remains unchanged
function deleteRowCluster(rowCluster) {
  if (gridSummaryData && gridSummaryData.blocks) {
    const newBlocks = {};
    Object.entries(gridSummaryData.blocks).forEach(([key, value]) => {
      if (!key.startsWith(rowCluster + ',')) {
        newBlocks[key] = value;
      }
    });
    gridSummaryData.blocks = newBlocks;
    visualizeGridSummary(gridSummaryData);
  }
}

// Block Details visualization function
function visualizeBlockDetails(blockData, blockType, columns) {
  const newContainer = document.querySelector('#newContainer');
  d3.select(newContainer).selectAll('svg').remove();

  const cellSize = 20;
  const gap = 5;
  const margin = 10;
  const headerHeight = 30;
  const startY = headerHeight + margin;

  const svgWidth = margin * 2 + blockData[0].length * (cellSize + gap) - gap;
  const svgHeight = startY + margin + blockData.length * (cellSize + gap) - gap;

  const detailSvg = d3.select(newContainer).append('svg')
    .attr('width', svgWidth)
    .attr('height', svgHeight);

  // Add column names as headers vertically
  if (columns) {
    columns.forEach((col, index) => {
      detailSvg.append('text')
        .attr('x', margin + index * (cellSize + gap) + cellSize / 2)
        .attr('y', headerHeight)
        .attr('text-anchor', 'middle')
        .attr('transform', `rotate(-90, ${margin + index * (cellSize + gap) + cellSize / 2}, ${headerHeight})`)
        .style('font-size', '12px')
        .text(col);
    });
  }

  // Draw cells
  blockData.forEach((row, rowIndex) => {
    let currentX = margin;
    
    row.forEach((value, colIndex) => {
      const columnName = columns[colIndex];
      const colorScale = globalColorScales[columnName];
      let cellColor;

      if (colorScale) {
        cellColor = colorScale.type === 'numerical' ? 
          colorScale.scale(Number(value)) : 
          colorScale.scale(value);
      } else {
        cellColor = blockType === 'numerical' ? '#fdd49e' : '#4682B4';
      }

      detailSvg.append('rect')
        .attr('x', currentX)
        .attr('y', startY + rowIndex * (cellSize + gap))
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('fill', cellColor)
        .append('title')
        .text(value);

      currentX += cellSize + gap;
    });
  });
}

function createLegends(colorScales) {
  // console.log('Creating legends with scales:', colorScales);
  
  // Remove any existing legends
  d3.select('.control-panel').selectAll('.legend-container').remove();
  
  // Create main container
  const legendContainer = d3.select('.control-panel')
    .append('div')
    .attr('class', 'legend-container');

  // Create numerical section
  const numericalBox = legendContainer.append('div')
    .attr('class', 'numerical-legend');

  numericalBox.append('h3')
    .style('font-size', '16px')
    .text('Numerical Values');

  // Get numerical columns for dropdown
  const numericalColumns = Object.entries(colorScales)
    .filter(([_, scale]) => scale.type === 'numerical')
    .map(([column, _]) => column);

  // console.log('Numerical columns:', numericalColumns);

  // Add column selector dropdown
  const dropdownContainer = numericalBox.append('div')
    .style('margin-bottom', '10px');

  dropdownContainer.append('select')
    .attr('id', 'numericalColumnSelect')
    .style('width', '100%')
    .style('padding', '5px')
    .style('background-color', '#2c3e50')
    .style('color', 'white')
    .style('border', '1px solid #34495e')
    .style('margin-bottom', '5px')
    .on('change', function() {
      const selectedColumn = this.value;
      // console.log('Selected numerical column:', selectedColumn);
      activeNumericalFilters.column = selectedColumn === 'Select a column...' ? null : selectedColumn;
      activeNumericalFilters.range = null;
      if (selectedColumn !== 'Select a column...') {
        updateNumericalLegend(colorScales[selectedColumn]);
      }
    })
    .selectAll('option')
    .data(['Select a column...'].concat(numericalColumns))
    .enter()
    .append('option')
    .text(d => d)
    .property('disabled', d => d === 'Select a column...')
    .property('selected', d => d === 'Select a column...');

  // Add clear numerical filter button
  numericalBox.append('button')
    .attr('id', 'clearNumericalFilter')
    .style('font-size', '0.8em')
    .style('padding', '2px 5px')
    .style('background-color', '#34495e')
    .style('border', 'none')
    .style('color', 'white')
    .style('cursor', 'pointer')
    .style('display', 'none')
    .text('Clear Numerical Filter')
    .on('click', () => {
      // console.log('Clearing numerical filter');
      activeNumericalFilters.column = null;
      activeNumericalFilters.range = null;
      d3.select('#numericalColumnSelect').property('value', 'Select a column...');
      updateVisualizationsWithFilters();
      updateNumericalLegendStyles();
    });

  // Create initial numerical legend
  createNumericalLegend(numericalBox);

  // Create categorical section
  const categoricalBox = legendContainer.append('div')
    .attr('class', 'categorical-legend');
    
  categoricalBox.append('h3')
    .style('font-size', '16px')
    .text('Categorical Values');

  // Sort scales
  const categoricalScales = {};
  Object.entries(colorScales).forEach(([column, scale]) => {
    if (scale.type === 'categorical') {
      categoricalScales[column] = scale;
    }
  });

  // console.log('Categorical scales:', categoricalScales);

  // Add interactive categorical legends
  if (Object.keys(categoricalScales).length > 0) {
    const uniqueSchemes = new Map();
    Object.entries(categoricalScales).forEach(([column, scale]) => {
      const schemeKey = scale.scale.range().join(',');
      if (!uniqueSchemes.has(schemeKey)) {
        uniqueSchemes.set(schemeKey, {
          scale: scale.scale,
          columns: [column]
        });
      } else {
        uniqueSchemes.get(schemeKey).columns.push(column);
      }
    });

    uniqueSchemes.forEach((schemeInfo, schemeKey) => {
      const schemeContainer = categoricalBox.append('div')
        .attr('class', 'scheme-container');
      
      schemeContainer.append('div')
        .style('font-size', '0.8em')
        .style('margin-bottom', '3px')
        .style('color', '#bdc3c7')
        .text(`Columns: ${schemeInfo.columns.join(', ')}`);

      // Add clear filters button
      const clearButton = schemeContainer.append('button')
        .style('font-size', '0.8em')
        .style('margin-bottom', '5px')
        .style('padding', '2px 5px')
        .style('background-color', '#34495e')
        .style('border', 'none')
        .style('color', 'white')
        .style('cursor', 'pointer')
        .style('display', 'none')
        .text('Clear Filters')
        .on('click', () => {
          // console.log('Clearing categorical filters for columns:', schemeInfo.columns);
          schemeInfo.columns.forEach(column => {
            activeFilters.delete(column);
          });
          updateVisualizationsWithFilters();
          updateLegendStyles();
        });

      const swatchContainer = schemeContainer.append('div')
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('gap', '5px');

      // Add interactive swatches
      schemeInfo.scale.domain().forEach((value) => {
        const swatchRow = swatchContainer.append('div')
          .style('display', 'flex')
          .style('align-items', 'center')
          .style('gap', '5px')
          .style('cursor', 'pointer')
          .on('click', () => {
            // console.log('Clicked categorical value:', value);
            schemeInfo.columns.forEach(column => {
              if (!activeFilters.has(column)) {
                activeFilters.set(column, new Set([value]));
              } else {
                const columnFilters = activeFilters.get(column);
                if (columnFilters.has(value)) {
                  columnFilters.delete(value);
                  if (columnFilters.size === 0) {
                    activeFilters.delete(column);
                  }
                } else {
                  columnFilters.add(value);
                }
              }
            });
            // console.log('Active filters after click:', Array.from(activeFilters.entries()));
            updateVisualizationsWithFilters();
            updateLegendStyles();
          });

        swatchRow.append('div')
          .attr('class', 'color-swatch')
          .style('width', '15px')
          .style('height', '15px')
          .style('background-color', schemeInfo.scale(value))
          .style('border', '1px solid transparent');

        swatchRow.append('span')
          .style('font-size', '0.8em')
          .text(value);
      });

      // Add "Other" swatch
      const otherRow = swatchContainer.append('div')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('gap', '5px')
        .style('cursor', 'pointer')
        .on('click', () => {
          schemeInfo.columns.forEach(column => {
            if (!activeFilters.has(column)) {
              activeFilters.set(column, new Set(['OTHER']));
            } else {
              const columnFilters = activeFilters.get(column);
              if (columnFilters.has('OTHER')) {
                columnFilters.delete('OTHER');
                if (columnFilters.size === 0) {
                  activeFilters.delete(column);
                }
              } else {
                columnFilters.add('OTHER');
              }
            }
          });
          updateVisualizationsWithFilters();
          updateLegendStyles();
        });

      otherRow.append('div')
        .attr('class', 'color-swatch')
        .style('width', '15px')
        .style('height', '15px')
        .style('background-color', schemeInfo.scale.unknown())
        .style('border', '1px solid transparent');

      otherRow.append('span')
        .style('font-size', '0.8em')
        .text('Other');
    });
  }
}


function createNumericalLegend(container) {
  const gradientHeight = 15;
  const labelSpacing = 15;
  
  // Add double range slider container
  const sliderContainer = container.append('div')
    .style('margin', '10px 0')
    .style('display', 'none')
    .attr('id', 'rangeSliderContainer');

  // Add min and max input fields
  const inputContainer = sliderContainer.append('div')
    .style('display', 'flex')
    .style('justify-content', 'space-between')
    .style('margin-bottom', '10px');

  const minInput = inputContainer.append('input')
    .attr('type', 'number')
    .attr('id', 'minRangeInput')
    .style('width', '45%')
    .style('background', '#2c3e50')
    .style('color', 'white')
    .style('border', '1px solid #34495e')
    .style('padding', '3px');

  const maxInput = inputContainer.append('input')
    .attr('type', 'number')
    .attr('id', 'maxRangeInput')
    .style('width', '45%')
    .style('background', '#2c3e50')
    .style('color', 'white')
    .style('border', '1px solid #34495e')
    .style('padding', '3px');

  // Add double range slider
  const slider = sliderContainer.append('div')
    .style('position', 'relative')
    .style('height', '20px');

  // Add track
  slider.append('div')
    .style('position', 'absolute')
    .style('left', '0')
    .style('right', '0')
    .style('top', '50%')
    .style('height', '4px')
    .style('background', '#34495e')
    .style('transform', 'translateY(-50%)');

  // Add range highlight
  slider.append('div')
    .attr('id', 'rangeHighlight')
    .style('position', 'absolute')
    .style('left', '0%')
    .style('right', '50%')
    .style('top', '50%')
    .style('height', '4px')
    .style('background', '#3498db')
    .style('transform', 'translateY(-50%)');

  // Add handles
  const minHandle = slider.append('div')
    .attr('id', 'minHandle')
    .style('position', 'absolute')
    .style('left', '0%')
    .style('top', '50%')
    .style('width', '12px')
    .style('height', '12px')
    .style('background', 'white')
    .style('border-radius', '50%')
    .style('transform', 'translate(-50%, -50%)')
    .style('cursor', 'pointer');

  const maxHandle = slider.append('div')
    .attr('id', 'maxHandle')
    .style('position', 'absolute')
    .style('left', '100%')
    .style('top', '50%')
    .style('width', '12px')
    .style('height', '12px')
    .style('background', 'white')
    .style('border-radius', '50%')
    .style('transform', 'translate(-50%, -50%)')
    .style('cursor', 'pointer');

  const gradientSvg = container.append('svg')
    .attr('id', 'numericalGradient')
    .attr('width', '100%')
    .attr('height', gradientHeight + labelSpacing * 2)
    .style('display', 'block');

  // Create gradient
  const gradient = gradientSvg.append('defs')
    .append('linearGradient')
    .attr('id', 'numerical-gradient')
    .attr('x1', '0%')
    .attr('x2', '100%');

  gradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', '#fdd49e');

  gradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', '#7f0000');

  gradientSvg.append('rect')
    .attr('x', 0)
    .attr('y', labelSpacing)
    .attr('width', '100%')
    .attr('height', gradientHeight)
    .style('fill', 'url(#numerical-gradient)');

  // Add labels
  gradientSvg.append('text')
    .attr('class', 'min-value')
    .attr('x', 0)
    .attr('y', labelSpacing - 3)
    .style('font-size', '0.8em')
    .style('fill', 'white')
    .text('Min');

  gradientSvg.append('text')
    .attr('class', 'max-value')
    .attr('x', '100%')
    .attr('y', labelSpacing - 3)
    .style('font-size', '0.8em')
    .style('text-anchor', 'end')
    .style('fill', 'white')
    .text('Max');

  // Add drag behavior
  let isDragging = false;
  let activeHandle = null;

  function startDrag(handle) {
    isDragging = true;
    activeHandle = handle;
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
  }

  function stopDrag() {
    isDragging = false;
    activeHandle = null;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
  }

  function onDrag(event) {
    if (!isDragging || !activeHandle || !activeNumericalFilters.column) return;

    const sliderRect = slider.node().getBoundingClientRect();
    const percentage = Math.max(0, Math.min(100,
      ((event.clientX - sliderRect.left) / sliderRect.width) * 100
    ));

    const scale = globalColorScales[activeNumericalFilters.column].scale;
    const domain = scale.domain();
    const value = domain[0] + (domain[1] - domain[0]) * (percentage / 100);

    if (activeHandle.id === 'minHandle') {
      const maxValue = activeNumericalFilters.range ? activeNumericalFilters.range[1] : domain[1];
      if (value < maxValue) {
        activeHandle.style.left = `${percentage}%`;
        document.getElementById('rangeHighlight').style.left = `${percentage}%`;
        activeNumericalFilters.range = [value, maxValue];
        minInput.property('value', value.toFixed(2));
      }
    } else {
      const minValue = activeNumericalFilters.range ? activeNumericalFilters.range[0] : domain[0];
      if (value > minValue) {
        activeHandle.style.left = `${percentage}%`;
        document.getElementById('rangeHighlight').style.right = `${100 - percentage}%`;
        activeNumericalFilters.range = [minValue, value];
        maxInput.property('value', value.toFixed(2));
      }
    }

    updateVisualizationsWithFilters();
  }

  minHandle.on('mousedown', () => startDrag(minHandle.node()));
  maxHandle.on('mousedown', () => startDrag(maxHandle.node()));

  // Add input handlers
  function updateFromInput() {
    if (!activeNumericalFilters.column) return;

    const scale = globalColorScales[activeNumericalFilters.column].scale;
    const domain = scale.domain();
    const minVal = Math.max(domain[0], Math.min(domain[1], +minInput.property('value')));
    const maxVal = Math.max(domain[0], Math.min(domain[1], +maxInput.property('value')));

    if (minVal < maxVal) {
      const minPercentage = ((minVal - domain[0]) / (domain[1] - domain[0])) * 100;
      const maxPercentage = ((maxVal - domain[0]) / (domain[1] - domain[0])) * 100;

      minHandle.style('left', `${minPercentage}%`);
      maxHandle.style('left', `${maxPercentage}%`);
      document.getElementById('rangeHighlight').style.left = `${minPercentage}%`;
      document.getElementById('rangeHighlight').style.right = `${100 - maxPercentage}%`;

      activeNumericalFilters.range = [minVal, maxVal];
      updateVisualizationsWithFilters();
    }
  }

  minInput.on('change', updateFromInput);
  maxInput.on('change', updateFromInput);
}

function updateNumericalLegend(colorScale) {
  const domain = colorScale.scale.domain();
  const gradientSvg = d3.select('#numericalGradient');
  
  // Update labels
  gradientSvg.select('.min-value').text(domain[0].toFixed(1));
  gradientSvg.select('.max-value').text(domain[1].toFixed(1));
  
  // Update gradient colors
  const gradient = d3.select('#numerical-gradient');
  gradient.selectAll('stop').remove();
  
  gradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', colorScale.scale(domain[0]));

  gradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', colorScale.scale(domain[1]));

  // Show range slider container and update input values
  const sliderContainer = d3.select('#rangeSliderContainer')
    .style('display', 'block');

  const minInput = d3.select('#minRangeInput')
    .attr('min', domain[0])
    .attr('max', domain[1])
    .attr('step', (domain[1] - domain[0]) / 100)
    .property('value', domain[0]);

  const maxInput = d3.select('#maxRangeInput')
    .attr('min', domain[0])
    .attr('max', domain[1])
    .attr('step', (domain[1] - domain[0]) / 100)
    .property('value', domain[1]);

  // Reset handles and highlight
  d3.select('#minHandle').style('left', '0%');
  d3.select('#maxHandle').style('left', '100%');
  d3.select('#rangeHighlight')
    .style('left', '0%')
    .style('right', '0%');
}


function updateVisualizationsWithColumnFilter() {
  if (!csvFileData) return;
  
  const filteredCSV = filterCSVByColumns(csvFileData);
  
  // Update color scales for the filtered columns
  const filteredData = d3.csvParse(filteredCSV);
  globalColorScales = generateColorScales(filteredData);
  
  // Update legends
  createLegends(globalColorScales);
  
  // Update visualizations
  visualizeCSVData(filteredCSV);
  
  // Update grid summary if active
  if (document.getElementById('gridSummaryButton').classList.contains('active')) {
    const formData = new FormData();
    const filteredBlob = new Blob([filteredCSV], { type: 'text/csv' });
    formData.append('file', filteredBlob, 'filtered.csv');
    formData.append('rowClusters', document.getElementById('rowClusters').value);
    formData.append('colClusters', document.getElementById('colClusters').value);

    fetch('/get_clusters', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      if (!data.error) {
        visualizeGridSummary(data);
      }
    })
    .catch(error => console.error('Error:', error));
  }
  
  // Update VSM
  const formData = new FormData();
  const filteredBlob = new Blob([filteredCSV], { type: 'text/csv' });
  formData.append('file', filteredBlob);
  
  fetch('/get_vsm', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    vsmData = data;
    updateVSMVisualization();
  })
  .catch(error => console.error('Error fetching VSM data:', error));
}

function updateNumericalLegendStyles() {
  const hasFilter = activeNumericalFilters.column && activeNumericalFilters.range;
  
  // Show/hide clear button
  d3.select('#clearNumericalFilter')
    .style('display', hasFilter ? 'block' : 'none');
  
  // Update gradient opacity
  d3.select('#numericalGradient rect')
    .style('opacity', hasFilter ? 0.5 : 1);
  
  if (hasFilter) {
    // Add range indicator
    const scale = globalColorScales[activeNumericalFilters.column].scale;
    const domain = scale.domain();
    const range = activeNumericalFilters.range;
    
    // Calculate positions for range indicator
    const x1 = (range[0] - domain[0]) / (domain[1] - domain[0]) * 100;
    const x2 = (range[1] - domain[0]) / (domain[1] - domain[0]) * 100;
    
    // Add or update range indicator
    const gradientSvg = d3.select('#numericalGradient');
    gradientSvg.selectAll('.range-indicator').remove();
    
    gradientSvg.append('rect')
      .attr('class', 'range-indicator')
      .attr('x', `${x1}%`)
      .attr('y', 15)
      .attr('width', `${x2 - x1}%`)
      .attr('height', 15)
      .style('fill', 'none')
      .style('stroke', 'white')
      .style('stroke-width', '2px');
  } else {
    // Remove range indicator
    d3.select('#numericalGradient').selectAll('.range-indicator').remove();
  }
}

function updateLegendStyles() {
  // Update swatch styles based on active filters
  d3.selectAll('.scheme-container').each(function() {
    const container = d3.select(this);
    const columnText = container.select('div').text();
    const columns = columnText.replace('Columns: ', '').split(', ');
    
    // Show/hide clear button
    const hasActiveFilters = columns.some(column => activeFilters.has(column));
    container.select('button')
      .style('display', hasActiveFilters ? 'block' : 'none');

    // Update swatch styles
    container.selectAll('.color-swatch').each(function(_, i) {
      const swatch = d3.select(this);
      const value = d3.select(this.parentNode).select('span').text();
      const isSelected = columns.some(column => 
        activeFilters.has(column) && 
        activeFilters.get(column).has(value === 'Other' ? 'OTHER' : value)
      );

      swatch
        .style('border', isSelected ? '2px solid white' : '1px solid transparent')
        .style('opacity', hasActiveFilters && !isSelected ? 0.5 : 1);
    });
  });
}

// function updateVisualizationsWithFilters() {
//   if (!csvFileData) return;

//   const data = d3.csvParse(csvFileData);
  
//   // Filter the data based on both categorical and numerical filters
//   const filteredData = data.filter(row => {
//     // Check categorical filters
//     const categoricalMatch = Array.from(activeFilters.entries()).every(([column, values]) => {
//       const rowValue = row[column];
//       return values.has(rowValue) || 
//              (values.has('OTHER') && !globalColorScales[column].scale.domain().includes(rowValue));
//     });
    
//     // Check numerical filter if active
//     let numericalMatch = true;
//     if (activeNumericalFilters.column && activeNumericalFilters.range) {
//       const value = +row[activeNumericalFilters.column];
//       numericalMatch = value >= activeNumericalFilters.range[0] && 
//                       value <= activeNumericalFilters.range[1];
//     }
    
//     return categoricalMatch && numericalMatch;
//   });

//   // Convert filtered data back to CSV
//   const filteredCsvData = d3.csvFormat(filteredData);

//   // Update visualizations with filtered data
//   visualizeCSVData(filteredCsvData);
  
//   // Update grid summary if active
//   if (document.getElementById('gridSummaryButton').classList.contains('active')) {
//     const formData = new FormData();
//     const filteredBlob = new Blob([filteredCsvData], { type: 'text/csv' });
//     formData.append('file', filteredBlob, 'filtered.csv');
//     formData.append('rowClusters', document.getElementById('rowClusters').value);
//     formData.append('colClusters', document.getElementById('colClusters').value);

//     fetch('/get_clusters', {
//       method: 'POST',
//       body: formData
//     })
//     .then(response => response.json())
//     .then(data => {
//       if (!data.error) {
//         visualizeGridSummary(data);
//       }
//     })
//     .catch(error => console.error('Error:', error));
//   }
  
//   // Update both legend styles
//   updateLegendStyles();
//   updateNumericalLegendStyles();
// }

function updateVisualizationsWithFilters() {
  if (!csvFileData) return;

  const data = d3.csvParse(csvFileData);
  
  // Filter the data based on both categorical and numerical filters
  const filteredData = data.filter(row => {
    // Check categorical filters
    const categoricalMatch = Array.from(activeFilters.entries()).every(([column, values]) => {
      const rowValue = row[column];
      return values.has(rowValue) || 
             (values.has('OTHER') && !globalColorScales[column].scale.domain().includes(rowValue));
    });
    
    // Check numerical filter if active
    let numericalMatch = true;
    if (activeNumericalFilters.column && activeNumericalFilters.range) {
      const value = +row[activeNumericalFilters.column];
      numericalMatch = value >= activeNumericalFilters.range[0] && 
                      value <= activeNumericalFilters.range[1];
    }
    
    return categoricalMatch && numericalMatch;
  });

  // Convert filtered data back to CSV
  const filteredCsvData = d3.csvFormat(filteredData);
  csvFileData = filteredCsvData; // Update the global csvFileData with filtered data

  // Update visualizations with filtered data
  visualizeCSVData(filteredCsvData);
  
  // Update grid summary if active
  if (document.getElementById('gridSummaryButton').classList.contains('active')) {
    const formData = new FormData();
    const filteredBlob = new Blob([filteredCsvData], { type: 'text/csv' });
    formData.append('file', new File([filteredBlob], 'filtered.csv', { type: 'text/csv' }));
    formData.append('rowClusters', document.getElementById('rowClusters').value);
    formData.append('colClusters', document.getElementById('colClusters').value);

    fetch('/get_clusters', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      if (!data.error) {
        gridSummaryData = data; // Update the global gridSummaryData
        visualizeGridSummary(data);
      }
    })
    .catch(error => console.error('Error:', error));
  }
  
  // Update both legend styles
  updateLegendStyles();
  updateNumericalLegendStyles();
}

async function fetchVSMData(csvData) {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await fetch('/get_vsm', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    vsmData = data;
    updateVSMVisualization();
  } catch (error) {
    console.error('Error fetching VSM data:', error);
  }
}

// Add this function to create the column selector
function createColumnSelector(columns) {
  allColumns = columns;
  selectedColumns = new Set(columns); // Initially select all columns
  
  const controlPanel = document.querySelector('.control-panel');
  const legendContainer = document.querySelector('.legend-container');
  
  // Create column selector container
  const selectorContainer = document.createElement('div');
  selectorContainer.className = 'column-selector';
  selectorContainer.style.backgroundColor = '#34495e';
  selectorContainer.style.padding = '10px';
  selectorContainer.style.borderRadius = '5px';
  selectorContainer.style.marginTop = '20px';
  
  // Add header
  const header = document.createElement('h3');
  header.textContent = 'Column Selection';
  header.style.fontSize = '16px';
  header.style.marginBottom = '10px';
  selectorContainer.appendChild(header);

  // Add select/deselect all buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.marginBottom = '10px';
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '10px';

  const selectAllBtn = document.createElement('button');
  selectAllBtn.textContent = 'Select All';
  selectAllBtn.style.padding = '5px 10px';
  selectAllBtn.style.backgroundColor = '#2c3e50';
  selectAllBtn.style.border = '1px solid #34495e';
  selectAllBtn.style.color = 'white';
  selectAllBtn.style.borderRadius = '3px';
  selectAllBtn.style.cursor = 'pointer';
  selectAllBtn.onclick = () => {
    checkboxes.forEach(cb => {
      cb.checked = true;
      selectedColumns.add(cb.value);
    });
    updateVisualizationsWithColumnFilter();
  };

  const deselectAllBtn = document.createElement('button');
  deselectAllBtn.textContent = 'Deselect All';
  deselectAllBtn.style.padding = '5px 10px';
  deselectAllBtn.style.backgroundColor = '#2c3e50';
  deselectAllBtn.style.border = '1px solid #34495e';
  deselectAllBtn.style.color = 'white';
  deselectAllBtn.style.borderRadius = '3px';
  deselectAllBtn.style.cursor = 'pointer';
  deselectAllBtn.onclick = () => {
    checkboxes.forEach(cb => {
      cb.checked = false;
      selectedColumns.delete(cb.value);
    });
    updateVisualizationsWithColumnFilter();
  };

  buttonContainer.appendChild(selectAllBtn);
  buttonContainer.appendChild(deselectAllBtn);
  selectorContainer.appendChild(buttonContainer);

  // Create scrollable checkbox container
  const checkboxContainer = document.createElement('div');
  checkboxContainer.style.maxHeight = '150px';
  checkboxContainer.style.overflowY = 'auto';
  checkboxContainer.style.padding = '5px';
  checkboxContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
  checkboxContainer.style.borderRadius = '3px';

  // Create checkboxes for each column
  const checkboxes = columns.map(column => {
    const label = document.createElement('label');
    label.style.display = 'block';
    label.style.padding = '3px 0';
    label.style.cursor = 'pointer';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = column;
    checkbox.checked = true;
    checkbox.style.marginRight = '8px';
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedColumns.add(column);
      } else {
        selectedColumns.delete(column);
      }
      updateVisualizationsWithColumnFilter();
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(column));
    checkboxContainer.appendChild(label);
    return checkbox;
  });

  selectorContainer.appendChild(checkboxContainer);
  
  // Insert the column selector before the legend container
  controlPanel.insertBefore(selectorContainer, legendContainer);
}

function filterCSVByColumns(csvData) {
  const data = d3.csvParse(csvData);
  
  // Ensure we only work with columns that actually exist in the data
  const validSelectedColumns = Array.from(selectedColumns)
    .filter(col => data.columns.includes(col));

  if (validSelectedColumns.length === 0) {
    console.warn('No valid columns selected for filtering');
    return csvData; // Return original data if no valid columns selected
  }

  const filteredData = data.map(row => {
    const filteredRow = {};
    validSelectedColumns.forEach(column => {
      if (row.hasOwnProperty(column)) {
        filteredRow[column] = row[column];
      }
    });
    return filteredRow;
  });

  return d3.csvFormat(filteredData);
}


// Update VSM visualization based on selected type
function updateVSMVisualization() {
  if (!vsmData) return;

  const vsmType = document.getElementById('vsmType').value;
  const container = document.getElementById('vsmCanvas');
  
  // Clear previous visualization
  d3.select(container).selectAll('svg').remove();

  // Get similarity matrix based on selected type
  const matrix = vsmType === 'columns' ? vsmData.column_similarity : vsmData.row_similarity;

  // Create SVG
  const margin = 5;
  const containerRect = container.getBoundingClientRect();
  const size = Math.min(containerRect.width, containerRect.height) - (margin * 2);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', size)
    .attr('height', size);

  // Create color scale
  const colorScale = d3.scaleLinear()
    .domain([0, 1])
    .range(['#fff', '#2c3e50']);

  // Draw cells
  const cellSize = size / matrix.length;
  
  matrix.forEach((row, i) => {
    row.forEach((value, j) => {
      svg.append('rect')
        .attr('x', j * cellSize)
        .attr('y', i * cellSize)
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('fill', colorScale(value));
    });
  });
}

// Add event listener for VSM type selection
document.getElementById('vsmType').addEventListener('change', updateVSMVisualization);

// Add this near your other global variables
let currentSortConfig = {
  column: null,
  direction: null
};

// // Add this function
// function initializeSortingControls(data) {
//   if (!data || !data.length) return;
  
//   // Get column names from the first row of data
//   const columns = Object.keys(data[0] || {});
  
//   // Remove any existing sorting controls
//   d3.select('.sorting-container').selectAll('.sorting-controls').remove();
  
//   // Create the controls container
//   const sortingControls = d3.select('.sorting-container')
//     .append('div')
//     .attr('class', 'sorting-controls');

//   // Add column selector dropdown
//   const columnSelect = sortingControls.append('select')
//     .attr('id', 'sortColumnSelect')
//     .attr('class', 'sorting-select')
//     .on('change', function() {
//       const selectedColumn = this.value;
//       const sortDirection = d3.select('#sortDirectionSelect').property('value');
//       if (selectedColumn !== 'Select a column...') {
//         updateSorting(selectedColumn, sortDirection);
//       }
//     });

//   // Add options to column selector
//   columnSelect.selectAll('option')
//     .data(['Select a column...'].concat(columns))
//     .enter()
//     .append('option')
//     .text(d => d)
//     .property('disabled', d => d === 'Select a column...')
//     .property('selected', d => d === 'Select a column...');

//   // Add sort direction selector
//   const directionSelect = sortingControls.append('select')
//     .attr('id', 'sortDirectionSelect')
//     .attr('class', 'sorting-select')
//     .on('change', function() {
//       const selectedColumn = d3.select('#sortColumnSelect').property('value');
//       const sortDirection = this.value;
//       if (selectedColumn !== 'Select a column...') {
//         updateSorting(selectedColumn, sortDirection);
//       }
//     });

//   // Add direction options
//   directionSelect.selectAll('option')
//     .data(['Ascending', 'Descending'])
//     .enter()
//     .append('option')
//     .text(d => d)
//     .property('value', d => d.toLowerCase());

//   // Add clear sorting button
//   sortingControls.append('button')
//     .attr('id', 'clearSorting')
//     .attr('class', 'sorting-button')
//     .text('Clear Sorting')
//     .on('click', () => {
//       d3.select('#sortColumnSelect').property('value', 'Select a column...');
//       d3.select('#sortDirectionSelect').property('value', 'ascending');
//       resetSorting();
//     });
// }


function updateSortingControlsForBlocks() {
  // Get the sorting container
  const sortingControls = d3.select('.sorting-controls');
  
  // Add block sorting criteria selector
  const blockSortSelect = sortingControls.append('select')
    .attr('id', 'blockSortSelect')
    .attr('class', 'sorting-select')
    .style('margin-top', '10px')
    .style('display', document.getElementById('gridSummaryButton').classList.contains('active') ? 'block' : 'none');

  // Add block sorting options
  blockSortSelect.selectAll('option')
    .data([
      { value: 'none', text: 'Select block sorting...' },
      { value: 'size', text: 'Block Size' },
      { value: 'mean', text: 'Mean Value (Numerical)' },
      { value: 'frequency', text: 'Most Frequent Value (Categorical)' }
    ])
    .enter()
    .append('option')
    .attr('value', d => d.value)
    .text(d => d.text)
    .property('disabled', d => d.value === 'none');

  // Add change event listener
  blockSortSelect.on('change', function() {
    const sortType = this.value;
    if (sortType !== 'none') {
      sortBlocks(sortType, d3.select('#sortDirectionSelect').property('value'));
    }
  });
}

function sortBlocks(sortType, direction) {
  if (!gridSummaryData || !gridSummaryData.blocks) return;

  const blocks = gridSummaryData.blocks;
  
  // Helper function to calculate block metrics
  function getBlockMetric(block, type) {
    switch(type) {
      case 'size':
        return block.data.length * block.data[0].length;
      case 'mean':
        if (block.type === 'numerical') {
          let sum = 0, count = 0;
          block.data.forEach(row => {
            row.forEach(val => {
              if (!isNaN(val) && val !== '') {
                sum += Number(val);
                count++;
              }
            });
          });
          return count > 0 ? sum / count : -Infinity;
        }
        return -Infinity;
      case 'frequency':
        if (block.type === 'categorical') {
          const valueCounts = {};
          block.data.forEach(row => {
            row.forEach(val => {
              if (val !== '') {
                valueCounts[val] = (valueCounts[val] || 0) + 1;
              }
            });
          });
          const maxCount = Math.max(...Object.values(valueCounts));
          return maxCount;
        }
        return -Infinity;
      default:
        return 0;
    }
  }

  // Sort blocks based on the selected metric
  const sortedBlocks = {};
  const blockEntries = Object.entries(blocks);
  
  blockEntries.sort((a, b) => {
    const metricA = getBlockMetric(a[1], sortType);
    const metricB = getBlockMetric(b[1], sortType);
    
    return direction === 'ascending' ? 
      metricA - metricB : 
      metricB - metricA;
  });

  // Rebuild blocks object with sorted entries
  blockEntries.forEach(([key, value]) => {
    sortedBlocks[key] = value;
  });

  // Update gridSummaryData with sorted blocks
  gridSummaryData.blocks = sortedBlocks;
  
  // Refresh visualization
  visualizeGridSummary(gridSummaryData);
}

// Modify existing initializeSortingControls to include block sorting
function initializeSortingControls(data) {
  if (!data || !data.length) return;
  
  const columns = Object.keys(data[0] || {});
  
  // Remove existing controls
  d3.select('.sorting-container').selectAll('.sorting-controls').remove();
  
  const sortingControls = d3.select('.sorting-container')
    .append('div')
    .attr('class', 'sorting-controls');

  // Add column selector dropdown
  const columnSelect = sortingControls.append('select')
    .attr('id', 'sortColumnSelect')
    .attr('class', 'sorting-select')
    .on('change', function() {
      const selectedColumn = this.value;
      const sortDirection = d3.select('#sortDirectionSelect').property('value');
      if (selectedColumn !== 'Select a column...') {
        updateSorting(selectedColumn, sortDirection);
      }
    });

  columnSelect.selectAll('option')
    .data(['Select a column...'].concat(columns))
    .enter()
    .append('option')
    .text(d => d)
    .property('disabled', d => d === 'Select a column...')
    .property('selected', d => d === 'Select a column...');

  // Add sort direction selector
  const directionSelect = sortingControls.append('select')
    .attr('id', 'sortDirectionSelect')
    .attr('class', 'sorting-select')
    .on('change', function() {
      const selectedColumn = d3.select('#sortColumnSelect').property('value');
      const sortDirection = this.value;
      if (selectedColumn !== 'Select a column...') {
        updateSorting(selectedColumn, sortDirection);
      }
      // Also update block sorting if active
      const blockSortType = d3.select('#blockSortSelect').property('value');
      if (blockSortType !== 'none') {
        sortBlocks(blockSortType, sortDirection);
      }
    });

  directionSelect.selectAll('option')
    .data(['Ascending', 'Descending'])
    .enter()
    .append('option')
    .text(d => d)
    .property('value', d => d.toLowerCase());

  // Add clear sorting button
  sortingControls.append('button')
    .attr('id', 'clearSorting')
    .attr('class', 'sorting-button')
    .text('Clear Sorting')
    .on('click', () => {
      d3.select('#sortColumnSelect').property('value', 'Select a column...');
      d3.select('#sortDirectionSelect').property('value', 'ascending');
      d3.select('#blockSortSelect').property('value', 'none');
      resetSorting();
    });

  // Add block sorting controls
  updateSortingControlsForBlocks();
}

// Add event listener to Grid Summary button to toggle block sorting controls
document.getElementById('gridSummaryButton').addEventListener('click', function() {
  const blockSort = document.getElementById('blockSortSelect');
  if (blockSort) {
    blockSort.style.display = this.classList.contains('active') ? 'block' : 'none';
  }
});

function updateSorting(column, direction) {
  if (!csvFileData) return;

  // Parse the current CSV data
  const data = d3.csvParse(csvFileData);
  
  // Store current sort configuration
  currentSortConfig.column = column;
  currentSortConfig.direction = direction;
  
  // Sort the data
  data.sort((a, b) => {
    let valueA = a[column];
    let valueB = b[column];
    
    // Handle numerical values
    if (!isNaN(valueA) && !isNaN(valueB)) {
      valueA = +valueA;
      valueB = +valueB;
    }
    
    // Handle null/undefined values
    if (valueA == null) return direction === 'ascending' ? -1 : 1;
    if (valueB == null) return direction === 'ascending' ? 1 : -1;
    
    // Compare values
    if (valueA < valueB) return direction === 'ascending' ? -1 : 1;
    if (valueA > valueB) return direction === 'ascending' ? 1 : -1;
    return 0;
  });

  // Convert back to CSV
  csvFileData = d3.csvFormat(data);
  
  // Update visualization
  visualizeCSVData(csvFileData);

  // Update grid summary if it's active
  if (document.getElementById('gridSummaryButton').classList.contains('active')) {
    const formData = new FormData();
    const sortedBlob = new Blob([csvFileData], { type: 'text/csv' });
    formData.append('file', new File([sortedBlob], 'sorted.csv', { type: 'text/csv' }));
    formData.append('rowClusters', document.getElementById('rowClusters').value);
    formData.append('colClusters', document.getElementById('colClusters').value);

    fetch('/get_clusters', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      if (!data.error) {
        visualizeGridSummary(data);
      }
    })
    .catch(error => console.error('Error:', error));
  }
}

function resetSorting() {
  currentSortConfig.column = null;
  currentSortConfig.direction = null;
  
  if (csvFileData) {
    visualizeCSVData(csvFileData);
    
    // Update grid summary if active
    if (document.getElementById('gridSummaryButton').classList.contains('active')) {
      const formData = new FormData();
      const blob = new Blob([csvFileData], { type: 'text/csv' });
      formData.append('file', new File([blob], 'reset.csv', { type: 'text/csv' }));
      formData.append('rowClusters', document.getElementById('rowClusters').value);
      formData.append('colClusters', document.getElementById('colClusters').value);

      fetch('/get_clusters', {
        method: 'POST',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        if (!data.error) {
          visualizeGridSummary(data);
        }
      })
      .catch(error => console.error('Error:', error));
    }
  }
}