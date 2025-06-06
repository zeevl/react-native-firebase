/*
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const { PATH, seed, wipe } = require('../helpers');

const TEST_PATH = `${PATH}/on`;

describe('database().ref().on()', function () {
  before(async function () {
    await seed(TEST_PATH);
  });

  after(async function () {
    await wipe(TEST_PATH);
  });

  beforeEach(async function beforeEachTest() {
    // @ts-ignore
    globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true;
  });

  afterEach(async function afterEachTest() {
    // @ts-ignore
    globalThis.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = false;
  });

  it('throws if event type is invalid', async function () {
    try {
      await firebase.database().ref().on('foo');
      return Promise.reject(new Error('Did not throw an Error.'));
    } catch (error) {
      error.message.should.containEql("'eventType' must be one of");
      return Promise.resolve();
    }
  });

  it('throws if callback is not a function', async function () {
    try {
      await firebase.database().ref().on('value', 'foo');
      return Promise.reject(new Error('Did not throw an Error.'));
    } catch (error) {
      error.message.should.containEql("'callback' must be a function");
      return Promise.resolve();
    }
  });

  it('throws if cancel callback is not a function', async function () {
    try {
      await firebase
        .database()
        .ref()
        .on('value', () => {}, 'foo');
      return Promise.reject(new Error('Did not throw an Error.'));
    } catch (error) {
      error.message.should.containEql("'cancelCallbackOrContext' must be a function or object");
      return Promise.resolve();
    }
  });

  it('throws if context is not an object', async function () {
    try {
      await firebase
        .database()
        .ref()
        .on(
          'value',
          () => {},
          () => {},
          'foo',
        );
      return Promise.reject(new Error('Did not throw an Error.'));
    } catch (error) {
      error.message.should.containEql("'context' must be an object.");
      return Promise.resolve();
    }
  });

  it('should callback with an initial value', async function () {
    const callback = sinon.spy();
    const ref = firebase.database().ref(`${TEST_PATH}/init`);
    ref.on('value', $ => {
      callback($.val());
    });

    const value = Date.now();
    await ref.set(value);
    await Utils.spyToBeCalledOnceAsync(callback, 5000);
    callback.should.be.calledWith(value);

    ref.off('value');
  });

  it('should callback multiple times when the value changes', async function () {
    const callback = sinon.spy();
    const date = Date.now();
    const ref = firebase.database().ref(`${TEST_PATH}/multi-change/${date}`);
    ref.on('value', $ => {
      callback($.val());
    });
    await ref.set('foo');
    await Utils.sleep(100);
    await ref.set('bar');
    await Utils.spyToBeCalledTimesAsync(callback, 2);
    ref.off('value');
    callback.getCall(0).args[0].should.equal('foo');
    callback.getCall(1).args[0].should.equal('bar');
  });

  // the cancelCallback is never called for ref.on but ref.once works?
  it('should cancel when something goes wrong', async function () {
    const successCallback = sinon.spy();
    const cancelCallback = sinon.spy();
    const ref = firebase.database().ref('nope');

    ref.on(
      'value',
      $ => {
        successCallback($.val());
      },
      error => {
        error.message.should.containEql(
          "Client doesn't have permission to access the desired data",
        );
        cancelCallback();
      },
    );
    await Utils.spyToBeCalledOnceAsync(cancelCallback);
    ref.off('value');
    successCallback.should.be.callCount(0);
  });

  // FIXME super flaky on android emulator
  it('subscribe to child added events', async function () {
    if (Platform.ios || Platform.other) {
      const successCallback = sinon.spy();
      const cancelCallback = sinon.spy();
      const ref = firebase.database().ref(`${TEST_PATH}/childAdded`);

      ref.on(
        'child_added',
        $ => {
          successCallback($.val());
        },
        () => {
          cancelCallback();
        },
      );

      await ref.child('child1').set('foo');
      await ref.child('child2').set('bar');
      await Utils.spyToBeCalledTimesAsync(successCallback, 2);
      ref.off('child_added');
      successCallback.getCall(0).args[0].should.equal('foo');
      successCallback.getCall(1).args[0].should.equal('bar');
      cancelCallback.should.be.callCount(0);
    } else {
      this.skip();
    }
  });

  // FIXME super flaky on Jet for ios/android
  it('subscribe to child changed events', async function () {
    if (Platform.other) {
      this.skip('Errors on JS SDK about a missing index.');
      return;
    }
    this.skip('Flakey');
    return;
    if (Platform.other) {
      const successCallback = sinon.spy();
      const cancelCallback = sinon.spy();
      const ref = firebase.database().ref(`${TEST_PATH}/childChanged`);
      const child = ref.child('changeme');
      await child.set('foo');

      ref.on(
        'child_changed',
        $ => {
          successCallback($.val());
        },
        () => {
          cancelCallback();
        },
      );

      const value1 = Date.now();
      const value2 = Date.now() + 123;

      await child.set(value1);
      await child.set(value2);
      await Utils.spyToBeCalledTimesAsync(successCallback, 2);
      ref.off('child_changed');
      successCallback.getCall(0).args[0].should.equal(value1);
      successCallback.getCall(1).args[0].should.equal(value2);
      cancelCallback.should.be.callCount(0);
    } else {
      this.skip();
    }
  });

  it('subscribe to child removed events', async function () {
    const successCallback = sinon.spy();
    const cancelCallback = sinon.spy();
    const ref = firebase.database().ref(`${TEST_PATH}/childRemoved`);
    const child = ref.child('removeme');
    await child.set('foo');
    await Utils.sleep(250);
    ref.on(
      'child_removed',
      $ => {
        successCallback($.val());
      },
      () => {
        cancelCallback();
      },
    );
    await Utils.sleep(250);
    await child.remove();
    await Utils.spyToBeCalledOnceAsync(successCallback, 5000);
    ref.off('child_removed');
    successCallback.getCall(0).args[0].should.equal('foo');
    cancelCallback.should.be.callCount(0);
  });

  it('subscribe to child moved events', async function () {
    if (Platform.other) {
      this.skip('Errors on JS SDK about a missing index.');
      return;
    }
    const callback = sinon.spy();
    const ref = firebase.database().ref(`${TEST_PATH}/childMoved`);
    const orderedRef = ref.orderByChild('nuggets');

    const initial = {
      alex: { nuggets: 60 },
      rob: { nuggets: 56 },
      vassili: { nuggets: 55.5 },
      tony: { nuggets: 52 },
      greg: { nuggets: 52 },
    };

    orderedRef.on('child_moved', $ => {
      // console.log($);
      callback($.val());
    });
    await ref.set(initial);
    await ref.child('greg/nuggets').set(57);
    await ref.child('rob/nuggets').set(61);
    await Utils.spyToBeCalledTimesAsync(callback, 2);
    ref.off('child_moved');
    callback.getCall(0).args[0].should.be.eql(jet.contextify({ nuggets: 57 }));
    callback.getCall(1).args[0].should.be.eql(jet.contextify({ nuggets: 61 }));
  });
});
