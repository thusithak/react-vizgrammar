/*
 * Copyright (c) 2017, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React from 'react';
import {
    VictoryChart,
    VictoryTheme,
    VictoryTooltip,
    VictoryContainer,
    VictoryVoronoiContainer,
    VictoryLegend,
    VictoryScatter,
    VictoryAxis,
    VictoryLabel,
} from 'victory';
import PropTypes from 'prop-types';
import { formatPrefix, scaleLinear, timeFormat } from 'd3';
import { getDefaultColorScale } from './helper';

export default class ScatterCharts extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            height: props.height || props.config.height || 450,
            width: props.width || props.config.width || 800,
            dataSets: {},
            chartArray: [],
            initialized: false,
            xScale: 'linear',
            orientation: 'bottom',
            legend: false,
            scatterPlotRange: [],
        };

        this._handleAndSortData = this._handleAndSortData.bind(this);
        this._handleMouseEvent = this._handleMouseEvent.bind(this);
    }

    componentDidMount() {
        this._handleAndSortData(this.props);
    }

    componentWillReceiveProps(nextProps) {
        this._handleAndSortData(nextProps);
    }

    componentWillUnmount() {
        this.setState({});
    }

    _handleMouseEvent(evt) {
        const { onClick } = this.props;
        return onClick && onClick(evt);
    }

    /**
     * Handles the sorting of data and populating the dataset
     * @param props
     */
    _handleAndSortData(props) {
        const { config, metadata, data } = props;
        let { dataSets, chartArray, initialized, xScale, orientation, legend, scatterPlotRange } = this.state;

        config.charts.map((chart, chartIndex) => {
            const xIndex = metadata.names.indexOf(chart.x);
            const yIndex = metadata.names.indexOf(chart.y);
            const colorIndex = metadata.names.indexOf(chart.color);
            const sizeIndex = metadata.names.indexOf(chart.size);
            xScale = metadata.types[xIndex] === 'time' ? 'time' : xScale;
            if (!initialized) {
                chartArray.push({
                    type: chart.type,
                    dataSetNames: {},
                    colorType: metadata.types[colorIndex],
                    colorScale: Array.isArray(chart.colorScale) ? chart.colorScale : getDefaultColorScale(),
                    colorIndex: 0,
                });
            }

            if (metadata.types[colorIndex] === 'linear') {
                legend = false;
                data.map((datum) => {
                    dataSets['scatterChart' + chartIndex] = dataSets['scatterChart' + chartIndex] || [];
                    dataSets['scatterChart' + chartIndex].push({
                        x: datum[xIndex],
                        y: datum[yIndex],
                        color: datum[colorIndex],
                        amount: datum[sizeIndex],
                    });

                    if (dataSets['scatterChart' + chartIndex].length > chart.maxLength) {
                        dataSets['scatterChart' + chartIndex].shift();
                    }

                    if (scatterPlotRange.length === 0) {
                        scatterPlotRange = [datum[colorIndex], datum[colorIndex]];
                    } else {
                        scatterPlotRange[0] = scatterPlotRange[0] > datum[colorIndex] ?
                            datum[colorIndex] : scatterPlotRange[0];
                        scatterPlotRange[1] = scatterPlotRange[1] < datum[colorIndex] ?
                            datum[colorIndex] : scatterPlotRange[1];
                    }
                    chartArray[chartIndex].dataSetNames['scatterChart' + chartIndex] =
                        chartArray[chartIndex].dataSetNames['scatterChart' + chartIndex] || null;
                });
            } else {
                data.map((datum) => {
                    let dataSetName = 'scatterChart' + chartIndex;
                    if (chart.color) {
                        const colorIndex = metadata.names.indexOf(chart.color);
                        dataSetName = colorIndex > -1 ? datum[colorIndex] : dataSetName;
                    }

                    dataSets[dataSetName] = dataSets[dataSetName] || [];
                    dataSets[dataSetName].push({ x: datum[xIndex], y: datum[yIndex], amount: datum[sizeIndex] });
                    if (dataSets[dataSetName].length > config.maxLength) {
                        dataSets[dataSetName].shift();
                    }

                    if (!chartArray[chartIndex].dataSetNames.hasOwnProperty(dataSetName)) {
                        if (chartArray[chartIndex].colorIndex >= chartArray[chartIndex].colorScale.length) {
                            chartArray[chartIndex].colorIndex = 0;
                        }

                        if (chart.colorDomain) {
                            const colorIn = chart.colorDomain.indexOf(dataSetName);
                            chartArray[chartIndex].dataSetNames[dataSetName] = colorIn >= 0 ?
                                (colorIn < chartArray[chartIndex].colorScale.length ?
                                    chartArray[chartIndex].colorScale[colorIn] :
                                    chartArray[chartIndex].colorScale[chartArray[chartIndex].colorIndex++]) :
                                chartArray[chartIndex].colorScale[chartArray[chartIndex].colorIndex++];
                        } else {
                            chartArray[chartIndex]
                                .dataSetNames[dataSetName] = chartArray[chartIndex]
                                    .colorScale[chartArray[chartIndex].colorIndex++];
                        }
                    }
                });
            }
        });
        initialized = true;
        this.setState({ dataSets, chartArray, initialized, xScale, orientation, legend, scatterPlotRange });
    }

    render() {
        const { config } = this.props;
        const { height, width, chartArray, dataSets, xScale, legend } = this.state;
        const chartComponents = [];
        const legendItems = [];

        chartArray.map((chart, chartIndex) => {
            if (chart.colorType === 'linear') {
                Object.keys(chart.dataSetNames).map((dataSetName) => {
                    chartComponents.push((
                        <VictoryScatter
                            bubbleProperty='amount'
                            maxBubbleSize={15}
                            minBubbleSize={5}
                            style={{
                                data: {
                                    fill: (d) => {
                                        return scaleLinear()
                                            .range([chart.colorScale[0], chart.colorScale[1]])
                                            .domain(this.state.scatterPlotRange)(d.color);
                                    },
                                },
                            }}
                            data={dataSets[dataSetName]}
                            labels={d => `${config.charts[chartIndex].x}:${d.x}\n
                                                   ${config.charts[chartIndex].y}:${d.y}\n
                                                   ${config.charts[chartIndex].size}:${d.amount}
                                                   ${config.charts[chartIndex].color}:${d.color}`}
                            labelComponent={
                                <VictoryTooltip
                                    orientation='bottom'
                                />
                            }
                            events={[{
                                target: 'data',
                                eventHandlers: {
                                    onClick: () => {
                                        return [
                                            {
                                                target: 'data',
                                                mutation: this._handleMouseEvent,
                                            },
                                        ];
                                    },
                                },
                            }]}

                        />
                    ));
                });
            } else {
                Object.keys(chart.dataSetNames).map((dataSetName) => {
                    chartComponents.push((
                        <VictoryScatter
                            bubbleProperty='amount'
                            maxBubbleSize={20}
                            minBubbleSize={5}
                            style={{ data: { fill: chart.dataSetNames[dataSetName] } }}
                            data={dataSets[dataSetName]}
                            labels={
                                d => `${config.charts[chartIndex].x}:${Number(d.x).toFixed(2)}\n
                                ${config.charts[chartIndex].y}:${Number(d.y).toFixed(2)}\n
                                ${config.charts[chartIndex].size}:${Number(d.amount).toFixed}\n
                                ${config.charts[chartIndex].color}:${d.color}`}
                            labelComponent={
                                <VictoryTooltip
                                    orientation='bottom'
                                />
                            }
                            events={[{
                                target: 'data',
                                eventHandlers: {
                                    onClick: () => {
                                        return [
                                            {
                                                target: 'data',
                                                mutation: this._handleMouseEvent,
                                            },
                                        ];
                                    },
                                },
                            }]}
                        />
                    ));
                });
            }
        });

        return (
            <div style={{ overflow: 'hidden' }}>
                <div
                    style={
                        legend ?
                        {
                            width: !config.legendOrientation ? '80%' :
                                    (() => {
                                        if (config.legendOrientation === 'left' || config.legendOrientation === 'right') {
                                            return '80%';
                                        } else return '100%';
                                    })(),
                            display: !config.legendOrientation ? 'inline' :
                                    (() => {
                                        if (config.legendOrientation === 'left' || config.legendOrientation === 'right') {
                                            return 'inline';
                                        } else return null;
                                    })(),
                            float: !config.legendOrientation ? 'right' : (() => {
                                if (config.legendOrientation === 'left') return 'right';
                                else if (config.legendOrientation === 'right') return 'left';
                                else return null;
                            })(),
                        } : null
                    }
                >
                    {
                        legend && (config.legendOrientation && config.legendOrientation === 'top') ?
                            this.generateLegendComponent(config, legendItems) :
                            null
                    }
                    <VictoryChart
                        width={width}
                        height={height}
                        theme={VictoryTheme.material}
                        container={<VictoryVoronoiContainer />}
                    >
                        <VictoryAxis
                            crossAxis
                            style={{ axisLabel: { padding: 35 }, fill: config.axisLabelColor || '#455A64' }}
                            label={config.charts[0].x}
                            tickFormat={xScale === 'linear' ?
                                (text) => {
                                    if (text.toString().match(/[a-z]/i)) {
                                        if (text.length > 5) {
                                            return text.subString(0, 4) + '...';
                                        } else {
                                            return text;
                                        }
                                    } else {
                                        return formatPrefix(',.0', Number(text));
                                    }
                                } :
                                config.timeFormat ?
                                    (date) => {
                                        return timeFormat(config.timeFormat)(new Date(date));
                                    } : null}
                            standalone={false}
                            tickLabelComponent={
                                <VictoryLabel
                                    angle={config.xAxisTickAngle || 0}
                                    style={{ fill: config.tickLabelColor || 'black' }}
                                />
                            }
                        />
                        <VictoryAxis
                            dependentAxis
                            crossAxis
                            style={{ axisLabel: { padding: 35 }, fill: config.axisLabelColor || '#455A64' }}
                            label={config.charts.length > 1 ? '' : config.charts[0].y}
                            standalone={false}
                            tickFormat={text => formatPrefix(',.0', Number(text))}
                            tickLabelComponent={
                                <VictoryLabel
                                    angle={config.yAxisTickAngle || 0}
                                    style={{ fill: config.tickLabelColor || 'black' }}
                                />
                            }
                        />
                        {chartComponents}
                    </VictoryChart>
                </div>
                {
                    legend && (!config.legendOrientation || config.legendOrientation !== 'top') ?
                        this.generateLegendComponent(config, legendItems) :
                        null
                }
            </div>
        );
    }

    /**
     * Generate legend component for the scatter plot.
     * @param config chart configuration json.
     * @param legendItems legendItems array
     */
    generateLegendComponent(config, legendItems) {
        return (
            <div
                style={{
                    width: !config.legendOrientation ? '15%' :
                        (() => {
                            if (config.legendOrientation === 'left' || config.legendOrientation === 'right') {
                                return '20%';
                            } else return '100%';
                        })(),
                    display: !config.legendOrientation ? 'inline' :
                        (() => {
                            if (config.legendOrientation === 'left' || config.legendOrientation === 'right') {
                                return 'inline';
                            } else return null;
                        })(),
                    float: !config.legendOrientation ? 'right' : (() => {
                        if (config.legendOrientation === 'left') return 'left';
                        else if (config.legendOrientation === 'right') return 'right';
                        else return null;
                    })(),
                }}
            >
                <VictoryLegend
                    containerComponent={<VictoryContainer responsive />}
                    height={(() => {
                        if (!config.legendOrientation) return this.state.height;
                        else if (config.legendOrientation === 'left' || config.legendOrientation === 'right') {
                            return this.state.height;
                        } else return 100;
                    })()}
                    width={(() => {
                        if (!config.legendOrientation) return 200;
                        else if (config.legendOrientation === 'left' || config.legendOrientation === 'right') return 200;
                        else return this.state.width;
                    })()}
                    orientation={
                        !config.legendOrientation ?
                            'vertical' :
                            (() => {
                                if (config.legendOrientation === 'left' || config.legendOrientation === 'right') {
                                    return 'vertical';
                                } else {
                                    return 'horizontal';
                                }
                            })()
                    }
                    centerTitle
                    title="Legend"
                    style={{
                        title: { fontSize: 25, fill: config.legendTitleColor },
                        labels: { fontSize: 20, fill: config.legendTextColor },
                    }}
                    data={legendItems.length > 0 ? legendItems : [{
                        name: 'undefined',
                        symbol: { fill: '#333' },
                    }]}
                />
            </div>
        );
    }
}

ScatterCharts.propTypes = {
    data: PropTypes.array,
    config: PropTypes.object.isRequired,
    metadata: PropTypes.object.isRequired,
    width: PropTypes.number,
    height: PropTypes.number,
    onClick: PropTypes.func,
};
