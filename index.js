var path = require('path');
var fs = require('fs');
var builder = require('xmlbuilder');

function defaultNameFormatter(browser, result) {
    return browser.name + '_' + result.description;
}

var TRXReporter = function (baseReporterDecorator, config, emitter, logger, helper, formatError) {
    var outputFile = config.outputFile;
    var shortTestName = !!config.shortTestName;
    var trimTimestamps = !!config.trimTimestamps;
    var nameFormatter = config.nameFormatter || defaultNameFormatter;
    var log = logger.create('reporter.trx');
    var hostName = require('os').hostname();
    var testRun;
    var resultSummary;
    var counters;
    var testDefinitions;
    var testListIdNotInAList;
    var testEntries;
    var results;
    var times;

    var customSectionElement;
    var customSectionConfig = config.customSection ? {
            asSeparateFile: false,
            separateFileName: 'custom.xml',
            rootElement: 'CustomSection',
            testXmlFormater: null, // syntax for this formater is like: function (xmlSectionObject, data) {},
            ...config.customSection
        } :
        null;

    var getTimestamp = function () {
        // todo: use local time ?
        return trimTimestamps ?
            new Date().toISOString().substr(0, 19) :
            new Date().toISOString();
    };

    var s4 = function () {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    };

    var newGuid = function () {
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    };

    var formatDuration = function (duration) {
        duration = duration | 0;
        var ms = duration % 1000;
        duration -= ms;
        var s = (duration / 1000) % 60;
        duration -= s * 1000;
        var m = (duration / 60000) % 60;
        duration -= m * 60000;
        var h = (duration / 3600000) % 24;
        duration -= h * 3600000;
        var d = duration / 86400000;

        return (d > 0 ? d + '.' : '') +
            (h < 10 ? '0' + h : h) + ':' +
            (m < 10 ? '0' + m : m) + ':' +
            (s < 10 ? '0' + s : s) + '.' +
            (ms < 10 ? '00' + ms : ms < 100 ? '0' + ms : ms);
    };

    baseReporterDecorator(this);

    this.onRunStart = function () {
        var userName = process.env.USERNAME || process.env.USER || "karma-custom-trx";
        var runStartTimestamp = getTimestamp();
        testRun = builder.create("TestRun", {
                version: '1.0',
                encoding: 'UTF-8'
            })
            .att('id', newGuid())
            .att('name', userName + '@' + hostName + ' ' + runStartTimestamp)
            .att('runUser', userName)
            .att('xmlns', 'http://microsoft.com/schemas/VisualStudio/TeamTest/2010');

        testRun.ele('TestSettings')
            .att('name', 'Karma Test Run')
            .att('id', newGuid());

        times = testRun.ele('Times');
        times.att('creation', runStartTimestamp);
        times.att('queuing', runStartTimestamp);
        times.att('start', runStartTimestamp);

        resultSummary = testRun.ele('ResultSummary');
        counters = resultSummary.ele('Counters');
        testDefinitions = testRun.ele('TestDefinitions');

        testListIdNotInAList = "8c84fa94-04c1-424b-9868-57a2d4851a1d";
        var testLists = testRun.ele('TestLists');

        testLists.ele('TestList')
            .att('name', 'Results Not in a List')
            .att('id', testListIdNotInAList);

        // seems to be VS is expecting that exact id
        testLists.ele('TestList')
            .att('name', 'All Loaded Results')
            .att('id', "19431567-8539-422a-85d7-44ee4e166bda");

        testEntries = testRun.ele('TestEntries');
        results = testRun.ele('Results');
        if (customSectionConfig) {
            if (customSectionConfig.asSeparateFile === true) {
                customSectionElement = builder.create(customSectionConfig.rootElement, {
                        version: '1.0',
                        encoding: 'UTF-8'
                    })
                    .att('id', newGuid())
                    .att('name', userName + '@' + hostName + ' ' + runStartTimestamp)
                    .att('runUser', userName);
            } else {
                customSectionElement = testRun.ele(customSectionConfig.rootElement);
            }
        }
    };

    this.onBrowserStart = function (browser) {};

    this.onBrowserComplete = function (browser) {
        var result = browser.lastResult;

        var passed = result.failed <= 0 && !result.error;
        resultSummary.att('outcome', passed ? 'Passed' : 'Failed');

        // todo: checkout if all theses numbers map well
        counters.att('total', result.total)
            .att('executed', result.total - result.skipped)
            .att('passed', result.success)
            .att('error', result.error ? 1 : 0)
            .att('failed', result.failed);

        // possible useful info:
        // todo: result.disconnected => this seems to happen occasionally? => Possibly handle it!
        // (result.netTime || 0) / 1000)
    };

    this.onRunComplete = function () {
        times.att('finish', getTimestamp());
        var xmlToOutput = testRun;
        let customSectionXml = customSectionElement;

        if(outputFile){
            helper.mkdirIfNotExists(path.dirname(outputFile), function () {
                fs.writeFile(outputFile, xmlToOutput.end({pretty: true}), function (err) {
                    if (err) {
                        log.warn('Cannot write TRX testRun\n\t' + err.message);
                    } else {
                        log.debug('TRX results written to "%s".', outputFile);
                    }
                });
            });
        }
        
        if (customSectionConfig && customSectionConfig.asSeparateFile === true) {
            fs.writeFile(customSectionConfig.separateFileName, customSectionXml.end({
                pretty: true
            }), function (err) {
                if (err) {
                    log.warn(`Cannot write XML custom section: '${customSectionConfig.rootElement}' \n\t` + err.message);
                } else {
                    log.debug('Custom XML results written to "%s".', customSectionConfig.separateFileName);
                }
            });
        }
    };

    this.specSuccess = this.specSkipped = this.specFailure = function (browser, result) {
        var unitTestId = newGuid();
        var unitTestName = shortTestName ?
            result.description :
            nameFormatter(browser, result);
        var className = result.suite.join('.');
        var codeBase = className + '.' + unitTestName;

        var unitTest = testDefinitions.ele('UnitTest')
            .att('name', unitTestName)
            .att('id', unitTestId);
        var executionId = newGuid();
        unitTest.ele('Execution')
            .att('id', executionId);
        unitTest.ele('TestMethod')
            .att('codeBase', codeBase)
            .att('name', unitTestName)
            .att('className', className);

        testEntries.ele('TestEntry')
            .att('testId', unitTestId)
            .att('executionId', executionId)
            .att('testListId', testListIdNotInAList);

        var unitTestResult = results.ele('UnitTestResult')
            .att('executionId', executionId)
            .att('testId', unitTestId)
            .att('testName', unitTestName)
            .att('computerName', hostName)
            .att('duration', formatDuration(result.time > 0 ? result.time : 0))
            .att('startTime', getTimestamp())
            .att('endTime', getTimestamp())
            // todo: are there other test types?
            .att('testType', '13cdc9d9-ddb5-4fa4-a97d-d965ccfc6d4b') // that guid seems to represent 'unit test'
            .att('outcome', result.skipped ? 'NotExecuted' : (result.success ? 'Passed' : 'Failed'))
            .att('testListId', testListIdNotInAList);

        if (customSectionConfig.testXmlFormater && customSectionConfig.testXmlFormater.call) {
            customSectionConfig.testXmlFormater.call(this, customSectionElement, {
                unitTestId,
                unitTestName,
                className,
                executionId,
                codeBase,
                hostName,
                duration:formatDuration(result.time > 0 ? result.time : 0),
                result
            });
        } else {
            var customUnitTest = customSectionElement.ele('UnitTest')
                .att('name', unitTestName)
                .att('id', unitTestId);
            customUnitTest.ele('Execution')
                .att('id', newGuid());
            customUnitTest.ele('TestMethod')
                .att('codeBase', codeBase)
                .att('name', unitTestName)
                .att('className', className);
        }

        if (!result.success) {
            unitTestResult.ele('Output')
                .ele('ErrorInfo')
                .ele('Message', formatError(result.log[0]))
        }
    };
};

TRXReporter.$inject = ['baseReporterDecorator', 'config.customTrxReporter', 'emitter', 'logger',
    'helper', 'formatError'
];

function extractJiraIdXmlFormater(xmlBuilderObject, data, overrideFn){

    if(overrideFn && typeof(overrideFn)==='function'){ // for overriding current behaviour 
        overrideFn(xmlBuilderObject, data);
        return;
    }

    const regexForJiraId = /(?<=\[).+?(?=\])/gi; // regex for extracting jira id from unit test name
    const matches = (data.codeBase || '').match(regexForJiraId); // extract all matches. There could be multiple describes(or its) that have Jira id set in description 
    if(matches && matches.length){ // if any match
      const requirementValue = `AltID_${matches.reverse()[0]}`; // get the deepest Jira Id from unit test name
      const testcaseTag = xmlBuilderObject.ele('testcase')
      .att('classname', data.className.replace(regexForJiraId, '').replace('[]',''))
      .att('name', data.unitTestName.replace(regexForJiraId, '').replace('[]',''));
      const requirementsTag = testcaseTag.ele('requirements');
      requirementsTag.ele('requirement', requirementValue);
    }
  }

// PUBLISH DI MODULE
module.exports = {
    'reporter:custom-trx': ['type', TRXReporter],
    extractJiraIdXmlFormater:extractJiraIdXmlFormater
};
