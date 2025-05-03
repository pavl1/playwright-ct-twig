/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// @ts-check

/** @typedef {import('../playwright-ct-core/types/component').Component} Component */

/**
 * @param {Component} component
 */

console.log('registerSource');

function __pwCreateComponent(component) {
  console.log('create component', component);
  if (component.__pw_type === 'twig') {
    const renderTemplate = component.template; // template уже является функцией рендера
    const renderedTemplate = renderTemplate(component.context || {});
    return { renderedTemplate };
  }
  throw new Error('Unsupported component type');
}

const __pwAppKey = Symbol('appKey');

window.playwrightMount = async (component, rootElement) => {
  console.log('mount', component, rootElement);
  const { renderedTemplate } = __pwCreateComponent(component);
  rootElement.innerHTML = renderedTemplate;
  rootElement[__pwAppKey] = true;
};

window.playwrightUnmount = async rootElement => {
    console.log('unmount', rootElement);
  if (!rootElement[__pwAppKey])
    throw new Error('Component was not mounted');
  rootElement.innerHTML = '';
  delete rootElement[__pwAppKey];
};

window.playwrightUpdate = async (rootElement, component) => {
  console.log('update', component, rootElement);
  if (!rootElement[__pwAppKey])
    throw new Error('Component was not mounted');
  const { renderedTemplate } = __pwCreateComponent(component);
  rootElement.innerHTML = renderedTemplate;
};