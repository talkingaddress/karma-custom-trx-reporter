# karma-custom-trx-reporter

> A Karma plugin. Report results in MSTest trx format or custom xml format.

## Installation

The easiest way is to keep `karma-custom-trx-reporter` as a devDependency in your `package.json`.
```json
{
  "devDependencies": {
    "karma": "~0.10",
    "karma-custom-trx-reporter": "~0.1"
  }
}
```

You can simple do it by:
```bash
npm install karma-custom-trx-reporter --save-dev
```

## Configuration
```js
// karma.conf.js
module.exports = function(config) {
  config.set({
    plugins: [
      ...
      require('karma-custom-trx-reporter')
    ],
    
    reporters: ['progress', 'custom-trx'],

    // the default configuration
    customTrxReporter: {
            asSeparateFile: false,
            separateFileName: 'custom.xml', // can be type of file
            rootElement: 'CustomSection', // can be overridden with any text
            testXmlFormater: null // syntax for this formater is like: function (xmlSectionObject, data) {} 
    }
  });
};
```

### outputFile
The output file specifies where the xml file will be written.

### shortTestName
The custom-trx reporter will attend the browser name to the test name by default.
This can be switched off with the shortTestName config property.

### nameFormatter
You can provide a custom function to format the `testName` field of the trx.

The `nameFormatter` is a function with parameters `(browser, result)` which returns a string.

When `shortTestName` is `true`, `nameFormatter` is ignored.

### asSeparateFile
When is set to true the reporter will generate a separate file besides the .trx file.

When is set to false (default value) the xml data will be included in .trx file under `rootElement` value (as element name) 
### separateFileName
Name of the generated file, when `asSeparateFile` is set to true
### rootElement
The parent element name for all xml unit tests
### testXmlFormater
A function for creating any custom xml format for each test

Parameters:
```
    xmlSectionObject - xmlbuilder object (https://github.com/oozcitak/xmlbuilder-js#readme)
    data - unit test data info { unitTestId, unitTestName, className, executionId, codeBase, hostName, duration, result } 
                                result : {fullName, description, id, log, skipped, disabled, pending, success, suite, time, executedExpectationsCount, passedExpectations, properties }
```

Syntax for function is ```js function (xmlSectionObject, data) {} ```

Example: 
```js function (xmlSectionObject, data) {
  xmlSectionObject.ele('any-text')
        .attr('name', data.unitTestName)
        .attr('duration', data.duration)
        .attr('description', '${data.unitTestName} from class ${data.className} ${result.skipped?'was skipped':''}')
} 
```

You can pass list of reporters as a CLI argument too:
```bash
karma start --reporters custom-trx,dots
```

----

For more information on Karma see the [homepage].


[homepage]: http://karma-runner.github.com
