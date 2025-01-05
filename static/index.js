// let filePath = null;
// let gradients = null;

// // document.getElementById('fullGridButton').addEventListener('click', function() {
// //   // Create a popup input box
// //   filePath = prompt("Please enter the file path:");

// //   // Check if the user entered a file path
// //   if (filePath) {
// //     console.log("File path entered:", filePath);

// //     // Send the file path to the Flask server
// //     fetch('/process_file', {
// //       method: 'POST',
// //       headers: {
// //         'Content-Type': 'application/json'
// //       },
// //       body: JSON.stringify({ file_path: filePath })
// //     })
// //     .then(response => response.json())
// //     .then(data => {
// //       if (data.error) {
// //         console.error('Error:', data.error);
// //       } else {
// //         console.log('Clusters:', data.clusters);
// //         // You can add further processing of the clusters here

// //         // Define the size of the rectangles and the gap
// //         const rectSize = 8; // Smaller size for the rectangles
// //         const gap = 3;

// //         // Select the container and clear any existing SVG content
// //         const container = d3.select('#fullGridButton').node().parentNode;
// //         d3.select(container).selectAll('svg').remove();

// //         // Create an SVG element within the container
// //         const svg = d3.select(container).append('svg')
// //           .attr('width', '100%')
// //           .attr('height', '100%');

// //         // Initialize the starting y position beneath the button
// //         let yPos = 60;

// //         // Custom color palette for string values
// //         const stringColorPalette = ['#ff9999', '#ff6666', '#ff4d4d', '#ff3333', '#ff1a1a', '#ff0000', '#e60000', '#cc0000', '#b30000', '#990000'];

// //         // Calculate color gradients for each index
// //         gradients = data.clusters[0][0].map((_, index) => {
// //           const values = data.clusters.flatMap(cluster => cluster.map(item => item[index]));
// //           if (values.every(value => typeof value === 'number')) {
// //             const min = Math.min(...values);
// //             const max = Math.max(...values);
// //             return d3.scaleLinear()
// //               .domain([min, max])
// //               .range(['#cce5ff', '#004085']); // Lightest to darkest blue
// //           } else if (values.every(value => typeof value === 'string')) {
// //             const uniqueValues = Array.from(new Set(values));
// //             return d3.scaleOrdinal()
// //               .domain(uniqueValues)
// //               .range(stringColorPalette); // Custom color palette for strings
// //           }
// //         });

// //         // Loop through each cluster
// //         data.clusters.forEach((cluster, clusterIndex) => {
// //           // Loop through each item in the cluster
// //           cluster.forEach((item, itemIndex) => {
// //             // Initialize the starting x position for the items
// //             let xPos = 10;

// //             // Loop through each element within the item
// //             item.forEach((element, elementIndex) => {
// //               // Add a rectangle for each element
// //               svg.append('rect')
// //                 .attr('x', xPos)
// //                 .attr('y', yPos)
// //                 .attr('width', rectSize)
// //                 .attr('height', rectSize)
// //                 .attr('fill', gradients[elementIndex](element));

// //               // Update the x position for the next element
// //               xPos += rectSize + gap;
// //             });

// //             // Update the y position for the next item
// //             yPos += rectSize + gap;
// //           });

// //           // Add extra space between clusters
// //           yPos += rectSize + gap;
// //         });

// //         // Set the height of the SVG dynamically based on the content
// //         svg.attr('height', yPos);
// //       }
// //     })
// //     .catch((error) => {
// //       console.error('Error:', error);
// //     });
// //   } else {
// //     console.log("No file path entered.");
// //   }
// // });

// document.getElementById('fullGridButton').addEventListener('click', function() {
//   // Create a file input element
//   const fileInput = document.createElement('input');
//   fileInput.type = 'file';
//   fileInput.accept = '.csv';

//   // Listen for file selection
//   fileInput.addEventListener('change', function(event) {
//     const file = event.target.files[0];
//     if (file) {
//       const reader = new FileReader();
//       reader.onload = function(e) {
//         const csvData = e.target.result;
//         visualizeCSVData(csvData);
//       };
//       reader.readAsText(file);
//     }
//   });

//   // Trigger the file input dialog
//   fileInput.click();
// });

// function visualizeCSVData(csvData) {
//   // Parse the CSV data
//   const data = d3.csvParse(csvData);

//   // Define the size of the rectangles and the gap
//   const rectSize = 10; // Size for the rectangles
//   const gap = 3;

//   // Get the column names
//   const columns = data.columns;

//   // Define the color palette for the top 4 most frequent values
//   const topColors = ['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c'];
//   const defaultColor = 'gray';

//   // Calculate the min and max values for each numerical column
//   const numericalScales = columns.map(col => {
//     const values = data.map(row => +row[col]).filter(value => !isNaN(value));
//     if (values.length > 0) {
//       const min = d3.min(values);
//       const max = d3.max(values);
//       return d3.scaleLinear()
//         .domain([min, max])
//         .range(['#fee0d2', '#67000d']); // Lightest to darkest red
//     }
//     return null;
//   });

//   // Calculate the frequency of each value for each categorical column
//   const categoricalColorScales = columns.map(col => {
//     const values = data.map(row => row[col]);
//     const valueCounts = values.reduce((acc, value) => {
//       if (isNaN(value)) {
//         acc[value] = (acc[value] || 0) + 1;
//       }
//       return acc;
//     }, {});

//     // Sort values by frequency and get the top 4 most frequent values
//     const sortedValues = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]);
//     const topValues = sortedValues.slice(0, 4).map(d => d[0]);

//     // Create a color scale for the top 4 most frequent values
//     const colorScale = d3.scaleOrdinal()
//       .domain(topValues)
//       .range(topColors);

//     return { colorScale, topValues };
//   });

//   // Select the container and clear any existing SVG content
//   const container = d3.select('#fullGridButton').node().parentNode;
//   d3.select(container).selectAll('svg').remove();

//   // Create an SVG element within the container
//   const svg = d3.select(container).append('svg')
//     .attr('width', '100%')
//     .attr('height', '100%')
//     .style('overflow', 'auto');

//   // Initialize the starting y position beneath the button
//   let yPos = 60;

//   // Initialize the maximum x position to determine the width of the SVG
//   let maxXPos = 0;

//   // Loop through each row in the data
//   data.forEach((row, rowIndex) => {
//     // Initialize the starting x position for the items
//     let xPos = 10;

//     // Loop through each value in the row
//     columns.forEach((col, colIndex) => {
//       const value = row[col];
//       let color;

//       if (!isNaN(value)) {
//         // Numerical value
//         color = numericalScales[colIndex] ? numericalScales[colIndex](+value) : defaultColor;
//       } else {
//         // Categorical value
//         const { colorScale, topValues } = categoricalColorScales[colIndex];
//         color = topValues.includes(value) ? colorScale(value) : defaultColor;
//       }

//       // Add a rectangle for each value
//       svg.append('rect')
//         .attr('x', xPos)
//         .attr('y', yPos)
//         .attr('width', rectSize)
//         .attr('height', rectSize)
//         .attr('fill', color);

//       // Update the x position for the next value
//       xPos += rectSize + gap;

//       // Update the maximum x position
//       if (xPos > maxXPos) {
//         maxXPos = xPos;
//       }
//     });

//     // Update the y position for the next row
//     yPos += rectSize + gap;
//   });

//   // Set the width and height of the SVG dynamically based on the content
//   svg.attr('width', maxXPos + 10);
//   svg.attr('height', yPos);
// }

// document.getElementById('gridSummaryButton').addEventListener('click', function() {
//   // Check if the file path has already been entered
//   if (filePath) {
//     console.log("Using previously entered file path:", filePath);

//     // Send the file path to the Flask server
//     fetch('/process_file', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({ file_path: filePath })
//     })
//     .then(response => response.json())
//     .then(data => {
//       if (data.error) {
//         console.error('Error:', data.error);
//       } else {
//         console.log('Clusters:', data.clusters);

//         // Define the size of the rectangles and the gap
//         const rectSize = 10; // Larger size for the summary rectangles
//         const gap = 4;

//         // Select the container and clear any existing SVG content
//         const container = d3.select('#gridSummaryButton').node().parentNode;
//         d3.select(container).selectAll('svg').remove();

//         // Create an SVG element within the container
//         const svg = d3.select(container).append('svg')
//           .attr('width', '100%')
//           .attr('height', '100%')
//           .call(d3.zoom().on("zoom", function (event) {
//             svg.attr("transform", event.transform);
//           }))
//           .append("g");

//         // Initialize the starting y position beneath the button
//         let yPos = 60;

//         // Loop through each cluster
//         data.clusters.forEach((cluster, clusterIndex) => {
//           // Initialize the starting x position for the summary rectangles
//           let xPos = 10;

//           // Calculate the summary values for each column
//           const summaryValues = cluster[0].map((_, index) => {
//             const values = cluster.map(item => item[index]);
//             if (values.every(value => typeof value === 'number')) {
//               const mean = d3.mean(values);
//               return mean;
//             } else if (values.every(value => typeof value === 'string')) {
//               const mode = d3.mode(values);
//               return mode;
//             }
//           });

//           // Loop through each summary value
//           summaryValues.forEach((value, index) => {
//             // Add a rectangle for each summary value
//             svg.append('rect')
//               .attr('x', xPos)
//               .attr('y', yPos)
//               .attr('width', rectSize)
//               .attr('height', rectSize)
//               .attr('fill', gradients[index](value));

//             // Update the x position for the next summary value
//             xPos += rectSize + gap;
//           });

//           // Update the y position for the next cluster
//           yPos += rectSize + gap;
//         });

//         // Set the height of the SVG dynamically based on the content
//         svg.attr('height', yPos);
//       }
//     })
//     .catch((error) => {
//       console.error('Error:', error);
//     });
//   } else {
//     console.log("No file path entered. Please enter the file path using the 'Full Grid' button first.");
//   }
// });

// document.getElementById('visualSimilarityMatrixButton').addEventListener('click', function() {
//   // Check if the file path has already been entered
//   if (filePath) {
//     console.log("Using previously entered file path:", filePath);

//     // Send the file path to the Flask server
//     fetch('/visual_similarity_matrix', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({ file_path: filePath })
//     })
//     .then(response => response.blob())
//     .then(blob => {
//       const url = URL.createObjectURL(blob);
//       const img = document.createElement('img');
//       img.src = url;
//       img.style.width = '100%';

//       // Select the image-wrapper and clear any existing content
//       const wrapper = d3.select('#visualSimilarityMatrixButton').node().parentNode.querySelector('.image-wrapper');
//       d3.select(wrapper).selectAll('*').remove();
//       wrapper.appendChild(img);
//     })
//     .catch((error) => {
//       console.error('Error:', error);
//     });
//   } else {
//     console.log("No file path entered. Please enter the file path using the 'Full Grid' button first.");
//   }
// });

// document.getElementById('scalableGridButton').addEventListener('click', function() {
//   // Check if the file path has already been entered
//   if (filePath) {
//     console.log("Using previously entered file path:", filePath);

//     // Get the container dimensions
//     const container = d3.select('#scalableGridButton').node().parentNode;
//     const containerHeight = container.clientHeight;
//     const rectSize = 10; // Size for the scalable grid rectangles
//     const gap = 4;

//     // Calculate the number of clusters based on the container height
//     const numClusters = Math.floor(containerHeight / (rectSize + gap));

//     // Send the file path and number of clusters to the Flask server
//     fetch('/cluster_by_number', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({ file_path: filePath, num_clusters: numClusters })
//     })
//     .then(response => response.json())
//     .then(data => {
//       if (data.error) {
//         console.error('Error:', data.error);
//       } else {
//         console.log('Clusters:', data.clusters);

//         // Select the container and clear any existing SVG content
//         d3.select(container).selectAll('svg').remove();

//         // Create an SVG element within the container
//         const svg = d3.select(container).append('svg')
//           .attr('width', '100%')
//           .attr('height', '100%')
//           .call(d3.zoom().on("zoom", debounce(function (event) {
//             svg.attr("transform", event.transform);
//             updateClusters();
//           }, 200)))
//           .append("g");

//         // Function to update clusters based on zoom level
//         function updateClusters() {
//           const transform = d3.zoomTransform(svg.node());
//           const newRectSize = rectSize / transform.k;
//           const newGap = gap / transform.k;
//           const newNumClusters = Math.floor(containerHeight / (newRectSize + newGap));

//           // Send the updated number of clusters to the Flask server
//           fetch('/cluster_by_number', {
//             method: 'POST',
//             headers: {
//               'Content-Type': 'application/json'
//             },
//             body: JSON.stringify({ file_path: filePath, num_clusters: newNumClusters })
//           })
//           .then(response => response.json())
//           .then(data => {
//             if (data.error) {
//               console.error('Error:', data.error);
//             } else {
//               console.log('Updated Clusters:', data.clusters);

//               // Clear existing content
//               svg.selectAll('*').remove();

//               // Initialize the starting y position beneath the button
//               let yPos = 60;

//               // Loop through each cluster
//               data.clusters.forEach((cluster, clusterIndex) => {
//                 // Initialize the starting x position for the scalable grid rectangles
//                 let xPos = 10;

//                 // Loop through each item in the cluster
//                 cluster.forEach((item, itemIndex) => {
//                   // Initialize the starting x position for the items
//                   xPos = 10;

//                   // Loop through each element within the item
//                   item.forEach((element, elementIndex) => {
//                     // Add a rectangle for each element
//                     svg.append('rect')
//                       .attr('x', xPos)
//                       .attr('y', yPos)
//                       .attr('width', newRectSize)
//                       .attr('height', newRectSize)
//                       .attr('fill', gradients[elementIndex](element));

//                     // Update the x position for the next element
//                     xPos += newRectSize + newGap;
//                   });

//                   // Update the y position for the next item
//                   yPos += newRectSize + newGap;
//                 });

//                 // Add extra space between clusters
//                 yPos += newRectSize + newGap;
//               });

//               // Set the height of the SVG dynamically based on the content
//               svg.attr('height', yPos);
//             }
//           })
//           .catch((error) => {
//             console.error('Error:', error);
//           });
//         }

//         // Initial call to update clusters
//         updateClusters();
//       }
//     })
//     .catch((error) => {
//       console.error('Error:', error);
//     });
//   } else {
//     console.log("No file path entered. Please enter the file path using the 'Full Grid' button first.");
//   }
// });

// // Debounce function to limit the rate at which a function can fire
// function debounce(func, wait) {
//   let timeout;
//   return function(...args) {
//     const context = this;
//     clearTimeout(timeout);
//     timeout = setTimeout(() => func.apply(context, args), wait);
//   };
// }

// Global variables to store file, data, and color scales
let file = null;
let csvFileData = null;
let globalColorScales = null;

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

// Modified file input handler
document.getElementById('csvFileInput').addEventListener('change', async function(event) {
  file = event.target.files[0];
  if (file) {
    try {
      // Read the file as text
      const reader = new FileReader();
      
      reader.onload = function(e) {
        csvFileData = e.target.result;
        try {
          // Parse CSV and generate color scales
          const data = d3.csvParse(csvFileData);
          globalColorScales = generateColorScales(data);
          
          // Update the search tab label
          document.querySelector('.search-tab label').innerHTML = 
            '<span class="magnifier-icon">&#128269;</span>' + file.name;
          
          // Automatically visualize the full grid
          visualizeCSVData(csvFileData);
        } catch (error) {
          console.error('Error processing CSV:', error);
          alert('Error processing the CSV file. Please check the file format.');
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

// Grid Summary button handler
document.getElementById('gridSummaryButton').addEventListener('click', function() {
  if (file) {
    const formData = new FormData();
    formData.append('file', file);

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

  // Create visualization using global color scales
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

// Grid Summary visualization function
function visualizeGridSummary(data) {
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

  // Calculate scaling factors
  const maxClusterLogicalWidth = Math.max(...Object.values(clusterWidths));
  const totalVerticalGaps = (rowClusters.length - 1) * 3;
  const heightScaleFactor = (availableHeight - totalVerticalGaps) / totalLogicalHeight;
  const maxBlocksInAnyCluster = Math.max(...Object.values(blocksPerCluster));
  const totalHorizontalGaps = maxBlocksInAnyCluster - 1;
  const gapWidth = 3;
  const totalGapWidth = totalHorizontalGaps * gapWidth;
  const widthScaleFactor = (availableWidth - totalGapWidth) / maxClusterLogicalWidth;

  let yPos = buttonHeight + 12;
  const clusterPositions = {};

  // Create visualization
  Object.entries(blocks).forEach(([key, blockInfo]) => {
    const [rowCluster, colCluster, blockId, blockType] = key.split(',');
    const block = blockInfo.data;
    const columns = blockInfo.columns;
    const scaledHeight = clusterHeights[rowCluster] * heightScaleFactor;
    const scaledWidth = block[0].length * widthScaleFactor;

    if (!clusterPositions[rowCluster]) {
      clusterPositions[rowCluster] = { x: 10, y: yPos };
      yPos += scaledHeight + 3;
    }

    const rect = svg.append('rect')
      .attr('x', clusterPositions[rowCluster].x)
      .attr('y', clusterPositions[rowCluster].y)
      .attr('width', scaledWidth)
      .attr('height', scaledHeight)
      .attr('fill', blockType === 'numerical' ? '#fdd49e' : '#4682B4')
      .style('cursor', 'pointer')
      .on('click', function() {
        visualizeBlockDetails(block, blockType, columns);
      });

    clusterPositions[rowCluster].x += scaledWidth + gapWidth;
  });
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
        .attr('x', margin + index * (cellSize + gap) + cellSize / 2) // Adjust x position
        .attr('y', headerHeight) // Adjust y position to be at the top of the grid
        .attr('text-anchor', 'middle') // Center align the text
        .attr('transform', `rotate(-90, ${margin + index * (cellSize + gap) + cellSize / 2}, ${headerHeight})`) // Rotate around the text's position
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