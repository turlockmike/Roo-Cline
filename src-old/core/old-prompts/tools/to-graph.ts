export function getToGraphDescription(): string {
    return `## to_graph
Description: Generate an HTML page with a graph visualization of the provided data using Chart.js. Accepts CSV or JSON formatted data.
Parameters:
- data: (required) The data to graph in CSV or JSON format
- type: (required) The type of graph to generate (line, bar, pie, or scatter)
- title: (optional) The title of the graph
- xLabel: (optional) Label for the X axis
- yLabel: (optional) Label for the Y axis
Usage:
<to_graph>
<data>Your CSV or JSON data here</data>
<type>Type of graph (line, bar, pie, scatter)</type>
<title>Graph title (optional)</title>
<xLabel>X-axis label (optional)</xLabel>
<yLabel>Y-axis label (optional)</yLabel>
</to_graph>

Example: Requesting to create a bar chart
<to_graph>
<data>
Month,Sales
January,1000
February,1200
March,900
April,1500
</data>
<type>bar</type>
<title>Monthly Sales</title>
<xLabel>Month</xLabel>
<yLabel>Sales ($)</yLabel>
</to_graph>`;
}