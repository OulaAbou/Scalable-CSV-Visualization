// Global variables to store file, data, and color scales
let file = null;
let csvFileData = null;
let globalColorScales = null;
let gridSummaryData = null; // Add this to store the grid summary data

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

// Modify the file input handler to create legends when data is loaded
document.getElementById('csvFileInput').addEventListener('change', async function(event) {
  file = event.target.files[0];
  if (file) {
    try {
      const reader = new FileReader();
      
      reader.onload = function(e) {
        csvFileData = e.target.result;
        try {
          const data = d3.csvParse(csvFileData);
          globalColorScales = generateColorScales(data);
          
          document.querySelector('.search-tab label').innerHTML = 
            '<span class="magnifier-icon">&#128269;</span>' + file.name;
          
          // Create legends after generating color scales
          createLegends(globalColorScales);
          
          visualizeCSVData(csvFileData);
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

// Context menu functions
function showContextMenu(event, rowCluster, colCluster) {
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

  contextMenu.append('div')
    .attr('class', 'context-menu-item')
    .text('Delete Column Cluster')
    .on('click', () => {
      deleteColumnCluster(colCluster);
      contextMenu.remove();
    });

  // Close menu when clicking outside
  d3.select('body').on('click.context-menu', function() {
    contextMenu.remove();
    d3.select('body').on('click.context-menu', null);
  });
}

function deleteRowCluster(rowCluster) {
  if (gridSummaryData && gridSummaryData.blocks) {
    // Filter out blocks with the specified row cluster
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

function deleteColumnCluster(colCluster) {
  if (gridSummaryData && gridSummaryData.blocks) {
    // Filter out blocks with the specified column cluster
    const newBlocks = {};
    Object.entries(gridSummaryData.blocks).forEach(([key, value]) => {
      const [row, col] = key.split(',');
      if (col !== colCluster) {
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

  // Create categorical section
  const categoricalBox = legendContainer.append('div')
    .attr('class', 'categorical-legend');
    
  categoricalBox.append('h3')
    .style('font-size', '16px')
    .text('Categorical Values');

  // Sort scales
  const numericalScales = {};
  const categoricalScales = {};
  Object.entries(colorScales).forEach(([column, colorScale]) => {
    if (colorScale.type === 'numerical') {
      numericalScales[column] = colorScale;
    } else {
      categoricalScales[column] = colorScale;
    }
  });

  // Add numerical gradient if we have numerical scales
  if (Object.keys(numericalScales).length > 0) {
    const referenceScale = Object.values(numericalScales)[0].scale;
    const colorRange = referenceScale.range();
    const gradientWidth = 150;
    const gradientHeight = 15;
    const labelSpacing = 15;

    const gradientSvg = numericalBox.append('svg')
      .attr('width', '100%')
      .attr('height', gradientHeight + labelSpacing * 2)
      .style('display', 'block');

    const gradient = gradientSvg.append('defs')
      .append('linearGradient')
      .attr('id', 'numerical-gradient')
      .attr('x1', '0%')
      .attr('x2', '100%');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', colorRange[0]);

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', colorRange[1]);

    gradientSvg.append('rect')
      .attr('x', 0)
      .attr('y', labelSpacing)
      .attr('width', '100%')
      .attr('height', gradientHeight)
      .style('fill', 'url(#numerical-gradient)');

    gradientSvg.append('text')
      .attr('x', 0)
      .attr('y', labelSpacing - 3)
      .style('font-size', '0.8em')
      .style('fill', 'white')
      .text('Min');

    gradientSvg.append('text')
      .attr('x', '100%')
      .attr('y', labelSpacing - 3)
      .style('font-size', '0.8em')
      .style('text-anchor', 'end')
      .style('fill', 'white')
      .text('Max');
  }

  // Add categorical legends
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
      const schemeContainer = categoricalBox.append('div');
      
      schemeContainer.append('div')
        .style('font-size', '0.8em')
        .style('margin-bottom', '3px')
        .style('color', '#bdc3c7')
        .text(`Columns: ${schemeInfo.columns.join(', ')}`);

      const swatchContainer = schemeContainer.append('div')
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('gap', '5px');

      // Add swatches for domain values
      schemeInfo.scale.domain().forEach((value) => {
        const swatchRow = swatchContainer.append('div')
          .style('display', 'flex')
          .style('align-items', 'center')
          .style('gap', '5px');

        swatchRow.append('div')
          .style('width', '15px')
          .style('height', '15px')
          .style('background-color', schemeInfo.scale(value));

        swatchRow.append('span')
          .style('font-size', '0.8em')
          .text(value);
      });

      // Add "Other" swatch
      const otherRow = swatchContainer.append('div')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('gap', '5px');

      otherRow.append('div')
        .style('width', '15px')
        .style('height', '15px')
        .style('background-color', schemeInfo.scale.unknown());

      otherRow.append('span')
        .style('font-size', '0.8em')
        .text('Other');
    });
  }
}