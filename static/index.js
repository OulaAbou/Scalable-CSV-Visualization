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

// Add click event listener to the search tab
document.querySelector('.search-tab').addEventListener('click', function() {
  document.getElementById('csvFileInput').click();
});

// Function to generate color scales for all columns
function generateColorScales(data) {
  const columns = data.columns;
  const colorScales = {};

  columns.forEach(col => {
    const values = data.map(row => row[col]);
    const isNumeric = values.every(value => !isNaN(value) && value !== '');

    if (isNumeric) {
      const numericValues = values.map(Number);
      const min = d3.min(numericValues);
      const max = d3.max(numericValues);
      colorScales[col] = {
        type: 'numerical',
        scale: d3.scaleLinear()
          .domain([min, max])
          .range(['#fdd49e', '#7f0000'])
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
          .unknown('gray')
      };
    }
  });

  return colorScales;
}

document.getElementById('csvFileInput').addEventListener('change', async function(event) {
  file = event.target.files[0];
  if (file) {
    try {
      const reader = new FileReader();
      
      reader.onload = async function(e) {
        csvFileData = e.target.result;
        try {
          const data = d3.csvParse(csvFileData);
          globalColorScales = generateColorScales(data);
          
          document.querySelector('.search-tab label').innerHTML = 
            '<span class="magnifier-icon">&#128269;</span>' + file.name;
          
          createLegends(globalColorScales);
          visualizeCSVData(csvFileData);
          
          // Fetch VSM data from backend
          await fetchVSMData(csvFileData);
        } catch (error) {
          console.error('Error processing CSV:', error);
          alert('Error processing CSV file. Please check the file format.');
        }
      };

      reader.onerror = function() {
        console.error('Error reading file');
        alert('Error reading the file. Please try again.');
      };

      reader.readAsText(file);
    } catch (error) {
      console.error('Error handling file:', error);
      alert('Error handling the file. Please try again.');
    }
  }
});


// Modified Full Grid button handler
document.getElementById('fullGridButton').addEventListener('click', function() {
  if (csvFileData) {
    visualizeCSVData(csvFileData);
  } else {
    alert('Please upload a CSV file first using the search tab.');
  }
});

// Update slider values display
document.getElementById('rowClusters').addEventListener('input', function() {
  document.getElementById('rowClustersValue').textContent = this.value;
});

document.getElementById('colClusters').addEventListener('input', function() {
  document.getElementById('colClustersValue').textContent = this.value;
});

// Grid Summary button handler
document.getElementById('gridSummaryButton').addEventListener('click', function() {
  if (file) {
    const formData = new FormData();
    formData.append('file', file);
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

// Full Grid visualization function
function visualizeCSVData(csvData) {
  const data = d3.csvParse(csvData);
  const rectSize = 8;
  const gap = 3;
  const columns = data.columns;

  const container = d3.select('#fullGridButton').node().parentNode;
  d3.select(container).selectAll('svg').remove();

  const svg = d3.select(container).append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .style('overflow', 'auto');

  let yPos = 20;
  let maxXPos = 0;

  data.forEach((row, rowIndex) => {
    let xPos = 10;

    columns.forEach((col, colIndex) => {
      const value = row[col];
      const colorScale = globalColorScales[col];
      let color;

      if (colorScale.type === 'numerical') {
        color = colorScale.scale(+value);
      } else {
        color = colorScale.scale(value);
      }

      svg.append('rect')
        .attr('x', xPos)
        .attr('y', yPos)
        .attr('width', rectSize)
        .attr('height', rectSize)
        .attr('fill', color);

      xPos += rectSize + gap;
      if (xPos > maxXPos) {
        maxXPos = xPos;
      }
    });

    yPos += rectSize + gap;
  });

  svg.attr('width', maxXPos + 10)
    .attr('height', yPos);
}

function visualizeGridSummary(data) {
  gridSummaryData = data;
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
  console.log('Creating legends with scales:', colorScales);
  
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

  console.log('Numerical columns:', numericalColumns);

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
      console.log('Selected numerical column:', selectedColumn);
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
      console.log('Clearing numerical filter');
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

  console.log('Categorical scales:', categoricalScales);

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
          console.log('Clearing categorical filters for columns:', schemeInfo.columns);
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
            console.log('Clicked categorical value:', value);
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
            console.log('Active filters after click:', Array.from(activeFilters.entries()));
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

// function createNumericalLegend(container) {
//   const gradientHeight = 15;
//   const labelSpacing = 15;

//   const gradientSvg = container.append('svg')
//     .attr('id', 'numericalGradient')
//     .attr('width', '100%')
//     .attr('height', gradientHeight + labelSpacing * 2)
//     .style('display', 'block');

//   // Create initial gradient
//   const gradient = gradientSvg.append('defs')
//     .append('linearGradient')
//     .attr('id', 'numerical-gradient')
//     .attr('x1', '0%')
//     .attr('x2', '100%');

//   gradient.append('stop')
//     .attr('offset', '0%')
//     .attr('stop-color', '#fdd49e');

//   gradient.append('stop')
//     .attr('offset', '100%')
//     .attr('stop-color', '#7f0000');

//   // Create interactive gradient rect
//   gradientSvg.append('rect')
//     .attr('x', 0)
//     .attr('y', labelSpacing)
//     .attr('width', '100%')
//     .attr('height', gradientHeight)
//     .style('fill', 'url(#numerical-gradient)')
//     .style('cursor', 'pointer')
//     .on('click', function(event) {
//       if (!activeNumericalFilters.column) return;
      
//       const bbox = this.getBoundingClientRect();
//       const x = event.clientX - bbox.left;
//       const percentage = x / bbox.width;
      
//       const scale = globalColorScales[activeNumericalFilters.column].scale;
//       const domain = scale.domain();
//       const selectedValue = domain[0] + (domain[1] - domain[0]) * percentage;
      
//       // Define range around clicked value
//       const rangeSize = (domain[1] - domain[0]) * 0.1; // 10% of total range
//       activeNumericalFilters.range = [
//         selectedValue - rangeSize,
//         selectedValue + rangeSize
//       ];
      
//       console.log('Selected numerical range:', activeNumericalFilters.range);
//       updateVisualizationsWithFilters();
//       updateNumericalLegendStyles();
//     });

//   // Add labels
//   gradientSvg.append('text')
//     .attr('class', 'min-value')
//     .attr('x', 0)
//     .attr('y', labelSpacing - 3)
//     .style('font-size', '0.8em')
//     .style('fill', 'white')
//     .text('Min');

//   gradientSvg.append('text')
//     .attr('class', 'max-value')
//     .attr('x', '100%')
//     .attr('y', labelSpacing - 3)
//     .style('font-size', '0.8em')
//     .style('text-anchor', 'end')
//     .style('fill', 'white')
//     .text('Max');
// }

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

function updateVisualizationsWithFilters() {
  if (!csvFileData) return;

  console.log('Updating visualizations with filters');
  console.log('Active categorical filters:', Array.from(activeFilters.entries()));
  console.log('Active numerical filters:', activeNumericalFilters);

  const data = d3.csvParse(csvFileData);
  
  const filteredData = data.filter(row => {
    // Check categorical filters
    const categoricalMatch = Array.from(activeFilters.entries()).every(([column, values]) => {
      const rowValue = row[column];
      const colorScale = globalColorScales[column];
      const isDomainValue = colorScale.scale.domain().includes(rowValue);
      
      return values.has(rowValue) || 
             (values.has('OTHER') && !isDomainValue);
    });
    
    // Check numerical filter if active
    let numericalMatch = true;
    if (activeNumericalFilters.column && activeNumericalFilters.range) {
      const value = +row[activeNumericalFilters.column];
      numericalMatch = value >= activeNumericalFilters.range[0] && 
                      value <= activeNumericalFilters.range[1];
    }
    
    return (activeFilters.size === 0 || categoricalMatch) && 
           (!activeNumericalFilters.range || numericalMatch);
  });

  console.log(`Filtered from ${data.length} to ${filteredData.length} rows`);

  // Convert filtered data back to CSV
  const filteredCsvData = d3.csvFormat(filteredData);

  // Update visualizations
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

// function updateNumericalLegend(colorScale) {
//   const domain = colorScale.scale.domain();
//   const gradientSvg = d3.select('#numericalGradient');
  
//   // Update labels
//   gradientSvg.select('.min-value').text(domain[0].toFixed(1));
//   gradientSvg.select('.max-value').text(domain[1].toFixed(1));
  
//   // Update gradient colors
//   const gradient = d3.select('#numerical-gradient');
//   gradient.selectAll('stop').remove();
  
//   gradient.append('stop')
//     .attr('offset', '0%')
//     .attr('stop-color', colorScale.scale(domain[0]));

//   gradient.append('stop')
//     .attr('offset', '100%')
//     .attr('stop-color', colorScale.scale(domain[1]));
// }



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