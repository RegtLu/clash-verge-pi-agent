import { createBrowserRouter, RouteObject } from 'react-router'

import Layout from './_layout'
import { navItems } from './_navigation'
import { navigationItems } from './_navigation-meta'
import ProxyPage from './proxies'

const navRoutes = navItems.map(
  (item) =>
    ({
      path: item.path,
      Component: item.Component,
    }) as RouteObject,
)

// The proxy page is hidden from the sidebar but remains reachable directly.
const proxyRoute: RouteObject = {
  path: navigationItems.proxies.path,
  Component: ProxyPage,
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [...navRoutes, proxyRoute],
  },
])
