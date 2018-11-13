#!/usr/bin/env node

const selianize = require("selianize").default
const program = require('commander')
const mkdirp = require('mkdirp');
const assert = require('assert')
const path = require('path');
const rimraf = require('rimraf')

program.version('0.0.0')
  .option('-s, --server <s>', 'Selenium server url')
  .option('-u, --user <s>', 'Browserstack user')
  .option('-k, --key <s>', 'Browserstack key')
  .option('-r, --resolution [s]', 'Resolution')
  .option('-o, --os <s>', 'OS')
  .option('-b, --browser [s]', 'Browser')
  .option('-t, --test <c>', 'Selenium IDE project')
  .parse(process.argv)

const fs = require('fs')
const cp = require('child_process')

assert.ok(program.server, 'need to define server -s [server]')
assert.ok(program.user, 'need to define user -u [user]')
assert.ok(program.key, 'need to define key -k [key]')
assert.ok(program.os, 'need to define os -o [os/version]')
assert.ok(program.test, 'need to define Selenium IDE tests -t [path/to/test.side]')


const server = program.server

const browser = program.browser || 'Chrome/62.0'

const splittedBrowser = browser.split('/')

const browserName = splittedBrowser[0]

const browserVersion = splittedBrowser.length > 1 ? splittedBrowser[1] : null

const osSplitted = program.os.split('/')

const os = osSplitted[0]

const osVersion =  (osSplitted.length > 1) ? osSplitted[1] : null

const resolution = program.resolution || '1280x1024'

const browserstackUser = program.user
const browserstackKey = program.key

const test = program.test

const file = JSON.parse(fs.readFileSync(test).toString());

selianize(file).then(tests => { // code
  const code = `
  const {Builder, By, Key, until} = require('selenium-webdriver');
  let configuration = {
    timeout: 10000,
  }
  const capabilities = {
    'browserName' : '${browserName}',
    ${browserVersion ? `'browser_version': '${browserVersion}',` : ''}
    'os' : '${os}',
    ${osVersion ? `'os_version': '${osVersion}',` : ''}
    'resolution' : '${resolution}',
    'browserstack.user' : '${browserstackUser}',
    'browserstack.key' : '${browserstackKey}',
  }
  var webdriver = require('selenium-webdriver');
  let tests = {};
  console.log('browser name', capabilities.browserName)
  var driver = new webdriver.Builder().
  withCapabilities(capabilities).
  usingServer('${server}').
  build();
  afterAll(() => {
    driver.quit()
  })
` + tests.globalConfig + '\n' + tests.tests.map(t => t.code).join('\n') + '\n' + tests.suites.map(x => x.code).join('\n')

  const projectName = `side-suite-${file.name}`
  rimraf.sync(projectName)
  fs.mkdirSync(projectName)
  fs.writeFileSync(
    path.join(projectName, 'package.json'),
    JSON.stringify({
      name: file.name,
      version: '0.0.0',
      jest: {
        modulePaths: [path.join(__dirname, '/node_modules')],
        setupTestFrameworkScriptFile: require.resolve(
          'jest-environment-selenium/dist/setup.js'
        ),
        testEnvironment: 'node',
      },
      dependencies: {},
    })
  )
  const fileName = projectName + '/seltest.test.js'
  fs.writeFileSync(fileName, code)
  try {
    const opts = {
      cwd: process.cwd() + '/' + projectName
    }
    cp.execSync(path.resolve(path.dirname(require.resolve('jest')), '../bin') + '/jest.js --runTestsByPath seltest.test.js', opts)
  } catch(e) {
    console.error(e)
    // do nothing
  }
});

