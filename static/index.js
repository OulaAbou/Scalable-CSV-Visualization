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
    // Parse CSV with special handling for malformed rows
    const allRows = csvData.split('\n');
    const headers = allRows[0].split(',').map(h => h.trim());
    const expectedColumns = headers.length;
    
    // Process each row to find extra and missing values
    const processedData = allRows.slice(1).map((row, rowIndex) => {
      const values = row.split(',').map(v => v.trim());
      const rowData = {
        _rowIndex: rowIndex, // Add row index for reference
      };
      
      // Store regular values and track missing values
      headers.forEach((header, i) => {
        rowData[header] = values[i] || '';
        if (!values[i] || values[i].trim() === '') {
          if (!rowData._missingColumns) rowData._missingColumns = [];
          rowData._missingColumns.push(header);
        }
      });
      
      // Store extra values if any exist
      if (values.length > expectedColumns) {
        rowData._extraValues = values.slice(expectedColumns);
        rowData._extraValuesStartIndex = expectedColumns;
      }
      
      return rowData;
    });

    const rectSize = 8;
    const gap = 3;
    
    // Only use columns that are currently selected
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

    // Add context menu for extra values
    const contextMenu = d3.select('body')
      .append('div')
      .attr('class', 'extra-values-menu')
      .style('position', 'absolute')
      .style('display', 'none')
      .style('background', '#2c3e50')
      .style('border', '1px solid #34495e')
      .style('padding', '5px')
      .style('border-radius', '3px')
      .style('z-index', '1000');

    // Add menu items
    contextMenu.append('div')
      .attr('class', 'menu-item')
      .text('Delete Selected')
      .style('padding', '5px 10px')
      .style('cursor', 'pointer')
      .style('color', 'white')
      .on('click', deleteSelectedExtraValues);

    let yPos = 20;
    let maxXPos = 0;
    let selectedExtraValues = new Set();

    function deleteSelectedExtraValues() {
      // Hide context menu
      contextMenu.style('display', 'none');

      // Remove selected extra values from the data
      processedData.forEach(row => {
        if (row._extraValues) {
          row._extraValues = row._extraValues.filter((_, i) => !selectedExtraValues.has(`${row._rowIndex}-${i}`));
          if (row._extraValues.length === 0) {
            delete row._extraValues;
            delete row._extraValuesStartIndex;
          }
        }
      });

      // Clear selection and redraw
      selectedExtraValues.clear();
      visualizeCSVData(convertProcessedDataToCSV(processedData, headers));
    }

    // Function to convert processed data back to CSV
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

    // Draw cells
    processedData.forEach((row) => {
      let xPos = 10;
      
      // Draw regular columns
      columns.forEach((col) => {
        const value = row[col];
        const isMissing = !value || value.trim() === '';
        const colorScale = globalColorScales[col];

        let color;
        if (isMissing) {
          color = '#ff0000';
        } else {
          try {
            if (colorScale.type === 'numerical') {
              const numValue = +value;
              color = !isNaN(numValue) ? colorScale.scale(numValue) : '#ff0000';
            } else if (colorScale.type === 'categorical') {
              color = colorScale.scale(value);
            }
          } catch (err) {
            console.warn(`Error applying color scale for column ${col}:`, err);
            color = '#cccccc';
          }
        }

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
          rect.style('stroke', '#880000')
              .style('stroke-width', '1px');
        }

        rect.append('title')
           .text(`${col}: ${isMissing ? 'Missing value' : value}`);

        // Make empty cells droppable
        if (isMissing) {
          rect.attr('class', 'grid-cell droppable')
              .on('dragover', function(event) {
                event.preventDefault();
                d3.select(this).style('stroke', '#00ff00');
              })
              .on('dragleave', function() {
                d3.select(this).style('stroke', '#880000');
              })
              .on('drop', function(event) {
                event.preventDefault();
                const sourceId = event.dataTransfer.getData('text/plain');
                const [sourceRow, sourceIndex] = sourceId.split('-');
                
                // Update data
                const sourceRowData = processedData[sourceRow];
                const droppedValue = sourceRowData._extraValues[sourceIndex];
                
                // Update the target cell
                row[col] = droppedValue;
                
                // Remove the value from extra values
                sourceRowData._extraValues.splice(sourceIndex, 1);
                if (sourceRowData._extraValues.length === 0) {
                  delete sourceRowData._extraValues;
                  delete sourceRowData._extraValuesStartIndex;
                }
                
                // Redraw the visualization
                visualizeCSVData(convertProcessedDataToCSV(processedData, headers));
              });
        }

        xPos += rectSize + gap;
      });

      // Draw extra values if they exist
      if (row._extraValues) {
        // Calculate position for extra values
        const extraXPos = 10 + (columns.length * (rectSize + gap));
        
        row._extraValues.forEach((value, i) => {
          const extraId = `${row._rowIndex}-${i}`;
          
          const extraRect = svg.append('rect')
            .attr('x', extraXPos + (i * (rectSize + gap)))
            .attr('y', yPos)
            .attr('width', rectSize)
            .attr('height', rectSize)
            .attr('fill', '#ff0000')
            .attr('class', 'extra-value')
            .attr('data-id', extraId)
            .style('cursor', 'pointer')
            .style('stroke', selectedExtraValues.has(extraId) ? '#00ff00' : '#880000')
            .style('stroke-width', '1px')
            .attr('draggable', true)
            .on('dragstart', function(event) {
              event.dataTransfer.setData('text/plain', extraId);
              event.dataTransfer.effectAllowed = 'move';
            })
            .on('click', function(event) {
              const id = d3.select(this).attr('data-id');
              if (event.ctrlKey || event.metaKey) {
                // Toggle selection
                if (selectedExtraValues.has(id)) {
                  selectedExtraValues.delete(id);
                  d3.select(this).style('stroke', '#880000');
                } else {
                  selectedExtraValues.add(id);
                  d3.select(this).style('stroke', '#00ff00');
                }
              } else {
                // Clear previous selection
                selectedExtraValues.clear();
                svg.selectAll('.extra-value').style('stroke', '#880000');
                // Select this item
                selectedExtraValues.add(id);
                d3.select(this).style('stroke', '#00ff00');
              }
            })
            .on('contextmenu', function(event) {
              event.preventDefault();
              if (selectedExtraValues.size > 0) {
                contextMenu
                  .style('display', 'block')
                  .style('left', (event.pageX + 5) + 'px')
                  .style('top', (event.pageY + 5) + 'px');
              }
            });

          extraRect.append('title')
            .text(`Extra value: ${value}`);

          maxXPos = Math.max(maxXPos, extraXPos + (i * (rectSize + gap)) + rectSize);
        });
      }

      maxXPos = Math.max(maxXPos, xPos);
      yPos += rectSize + gap;
    });

    // Hide context menu when clicking outside
    d3.select('body').on('click', function(event) {
      if (!event.target.closest('.extra-values-menu')) {
        contextMenu.style('display', 'none');
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

// Store the original data order for reference
let originalDataOrder = null;
let currentClusteredData = null;

// function synchronizeGridViews(clusterData) {
//   if (!csvFileData || !clusterData || !clusterData.blocks) return;
  
//   const data = d3.csvParse(csvFileData);
//   currentClusteredData = clusterData;
  
//   // Store original order if not already stored
//   if (!originalDataOrder) {
//     originalDataOrder = {
//       rows: data.map((_, i) => i),
//       columns: data.columns.slice()
//     };
//   }

//   // Get unique row clusters in order
//   const rowClusters = [...new Set(Object.keys(clusterData.blocks).map(key => key.split(',')[0]))];
  
//   // Create ordered arrays for rows and columns
//   let rowOrder = [];
//   let columnOrder = new Set();
  
//   // Process blocks by row cluster order
//   rowClusters.forEach(rowCluster => {
//     // Get all blocks for this row cluster
//     const clusterBlocks = Object.entries(clusterData.blocks)
//       .filter(([key]) => key.split(',')[0] === rowCluster);
    
//     // Calculate number of rows in this cluster from first block
//     if (clusterBlocks.length > 0) {
//       const rowCount = clusterBlocks[0][1].data.length;
//       const startIdx = rowOrder.length;
      
//       // Add indices for all rows in this cluster
//       for (let i = 0; i < rowCount; i++) {
//         rowOrder.push(startIdx + i);
//       }
      
//       // Add columns from all blocks in this cluster
//       clusterBlocks.forEach(([_, block]) => {
//         if (block.columns) {
//           block.columns.forEach(col => columnOrder.add(col));
//         }
//       });
//     }
//   });

//   // Reorder the data based on clustering
//   const reorderedData = rowOrder.map(i => {
//     if (i < data.length) {
//       return data[i];
//     }
//     // Handle case where index is out of bounds
//     console.warn(`Row index ${i} is out of bounds`);
//     return data[data.length - 1]; // Use last row as fallback
//   });
  
//   const reorderedColumns = Array.from(columnOrder);
  
//   // Create new CSV string with reordered data
//   const reorderedCsv = d3.csvFormat(reorderedData.map(row => {
//     const newRow = {};
//     reorderedColumns.forEach(col => {
//       if (row.hasOwnProperty(col)) {
//         newRow[col] = row[col];
//       }
//     });
//     return newRow;
//   }));

//   // Update visualizations with reordered data
//   visualizeCSVData(reorderedCsv);
  
//   // Add visual cluster boundaries
//   addClusterBoundaries(rowClusters, reorderedData.length);
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
  
  // Create a map of ID to row data
  const idToRow = new Map();
  originalData.forEach(row => {
    idToRow.set(row.ID.toString(), row);
  });

  // Build ordered rows based on block data
  let orderedRows = [];
  let processedIds = new Set();
  
  // Process each row cluster in order
  rowClusters.forEach(rowCluster => {
    // Get all blocks for this row cluster
    const clusterBlocks = Object.entries(clusterData.blocks)
      .filter(([key]) => key.split(',')[0] === rowCluster)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

    // Process each block
    clusterBlocks.forEach(([_, block]) => {
      // Get IDs from this block's data
      block.data.forEach(rowData => {
        const id = rowData[0].toString(); // First column is ID
        if (!processedIds.has(id)) {
          const originalRow = idToRow.get(id);
          if (originalRow) {
            orderedRows.push(originalRow);
            processedIds.add(id);
          }
        }
      });
    });
  });

  // Add any remaining unprocessed rows
  originalData.forEach(row => {
    if (!processedIds.has(row.ID.toString())) {
      orderedRows.push(row);
    }
  });

  // Get ordered columns
  const columnOrder = new Set();
  Object.values(clusterData.blocks).forEach(block => {
    if (block.columns) {
      block.columns.forEach(col => columnOrder.add(col));
    }
  });

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

  // Update visualizations with filtered data
  visualizeCSVData(filteredCsvData);
  
  // Update grid summary if active
  if (document.getElementById('gridSummaryButton').classList.contains('active')) {
    const formData = new FormData();
    const filteredBlob = new Blob([filteredCsvData], { type: 'text/csv' });
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