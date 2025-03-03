import type { Serialized } from '@rocket.chat/core-typings';
import type { Method, OperationParams, OperationResult, PathPattern, UrlParams } from '@rocket.chat/rest-typings';
import type { ServerMethodName, ServerMethodParameters, ServerMethodReturn, TranslationKey } from '@rocket.chat/ui-contexts';
import {
	AuthorizationContext,
	ConnectionStatusContext,
	RouterContext,
	ServerContext,
	SettingsContext,
	TranslationContext,
	UserContext,
	ActionManagerContext,
	ModalContext,
} from '@rocket.chat/ui-contexts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { WrapperComponent } from '@testing-library/react-hooks';
import type { ObjectId } from 'mongodb';
import type { ContextType, ReactNode } from 'react';
import React from 'react';

class MockedAppRootBuilder {
	private wrappers: Array<(children: ReactNode) => ReactNode> = [];

	private connectionStatus: ContextType<typeof ConnectionStatusContext> = {
		connected: true,
		status: 'connected',
		retryTime: undefined,
		reconnect: () => undefined,
	};

	private server: ContextType<typeof ServerContext> = {
		absoluteUrl: (path: string) => `http://localhost:3000/${path}`,
		callEndpoint: <TMethod extends Method, TPathPattern extends PathPattern>(_args: {
			method: TMethod;
			pathPattern: TPathPattern;
			keys: UrlParams<TPathPattern>;
			params: OperationParams<TMethod, TPathPattern>;
		}): Promise<Serialized<OperationResult<TMethod, TPathPattern>>> => {
			throw new Error('not implemented');
		},
		getSingleStream: () => () => () => undefined,
		getStream: () => () => () => undefined,
		uploadToEndpoint: () => Promise.reject(new Error('not implemented')),
		callMethod: () => Promise.reject(new Error('not implemented')),
		info: undefined,
	};

	private router: ContextType<typeof RouterContext> = {
		buildRoutePath: () => '/',
		defineRoutes: () => () => undefined,
		getLocationPathname: () => '/',
		getLocationSearch: () => '',
		getRouteName: () => undefined,
		getRouteParameters: () => ({}),
		getRoutes: () => [],
		getSearchParameters: () => ({}),
		navigate: () => undefined,
		subscribeToRouteChange: () => () => undefined,
		subscribeToRoutesChange: () => () => undefined,
	};

	private settings: ContextType<typeof SettingsContext> = {
		hasPrivateAccess: true,
		isLoading: false,
		querySetting: (_id: string) => [() => () => undefined, () => undefined],
		querySettings: () => [() => () => undefined, () => []],
		dispatch: async () => undefined,
	};

	private translation: ContextType<typeof TranslationContext> = {
		language: 'en',
		languages: [
			{
				en: 'English',
				key: 'en',
				name: 'English',
			},
		],
		loadLanguage: () => Promise.resolve(),
		translate: Object.assign((key: string) => key, {
			has: (_key: string): _key is TranslationKey => true,
		}),
	};

	private user: ContextType<typeof UserContext> = {
		loginWithPassword: () => Promise.reject(new Error('not implemented')),
		logout: () => Promise.reject(new Error('not implemented')),
		loginWithService: () => () => Promise.reject(new Error('not implemented')),
		loginWithToken: () => Promise.reject(new Error('not implemented')),
		queryAllServices: () => [() => () => undefined, () => []],
		queryPreference: () => [() => () => undefined, () => undefined],
		queryRoom: () => [() => () => undefined, () => undefined],
		querySubscription: () => [() => () => undefined, () => undefined],
		querySubscriptions: () => [() => () => undefined, () => []],
		user: null,
		userId: null,
	};

	private modal: ContextType<typeof ModalContext> = {
		currentModal: null,
		modal: {
			setModal: () => undefined,
		},
	};

	private authorization: ContextType<typeof AuthorizationContext> = {
		queryPermission: () => [() => () => undefined, () => false],
		queryAtLeastOnePermission: () => [() => () => undefined, () => false],
		queryAllPermissions: () => [() => () => undefined, () => false],
		queryRole: () => [() => () => undefined, () => false],
		roleStore: {
			roles: {},
			emit: () => undefined,
			on: () => () => undefined,
			off: () => undefined,
			events: (): Array<'change'> => ['change'],
			has: () => false,
			once: () => () => undefined,
		},
	};

	wrap(wrapper: (children: ReactNode) => ReactNode): this {
		this.wrappers.push(wrapper);
		return this;
	}

	withEndpoint<TMethod extends Method, TPathPattern extends PathPattern>(
		method: TMethod,
		pathPattern: TPathPattern,
		response: (
			params: OperationParams<TMethod, TPathPattern>,
		) => Serialized<OperationResult<TMethod, TPathPattern>> | Promise<Serialized<OperationResult<TMethod, TPathPattern>>>,
	): this {
		const innerFn = this.server.callEndpoint;

		const outerFn = <TMethod extends Method, TPathPattern extends PathPattern>(args: {
			method: TMethod;
			pathPattern: TPathPattern;
			keys: UrlParams<TPathPattern>;
			params: OperationParams<TMethod, TPathPattern>;
		}): Promise<Serialized<OperationResult<TMethod, TPathPattern>>> => {
			if (args.method === String(method) && args.pathPattern === String(pathPattern)) {
				return Promise.resolve(response(args.params)) as Promise<Serialized<OperationResult<TMethod, TPathPattern>>>;
			}

			return innerFn(args);
		};

		this.server.callEndpoint = outerFn;

		return this;
	}

	withMethod<TMethodName extends ServerMethodName>(methodName: TMethodName, response: () => ServerMethodReturn<TMethodName>): this {
		const innerFn = this.server.callMethod;

		const outerFn = <TMethodName extends ServerMethodName>(
			innerMethodName: TMethodName,
			...innerArgs: ServerMethodParameters<TMethodName>
		): Promise<ServerMethodReturn<TMethodName>> => {
			if (innerMethodName === String(methodName)) {
				return Promise.resolve(response()) as Promise<ServerMethodReturn<TMethodName>>;
			}

			if (!innerFn) {
				throw new Error('not implemented');
			}

			return innerFn(innerMethodName, ...innerArgs);
		};

		this.server.callMethod = outerFn;

		return this;
	}

	withPermission(permission: string): this {
		const innerFn = this.authorization.queryPermission;

		const outerFn = (
			innerPermission: string | ObjectId,
			innerScope?: string | ObjectId | undefined,
			innerScopedRoles?: string[] | undefined,
		): [subscribe: (onStoreChange: () => void) => () => void, getSnapshot: () => boolean] => {
			if (innerPermission === permission) {
				return [() => () => undefined, () => true];
			}

			return innerFn(innerPermission, innerScope, innerScopedRoles);
		};

		this.authorization.queryPermission = outerFn;

		const innerFn2 = this.authorization.queryAtLeastOnePermission;

		const outerFn2 = (
			innerPermissions: Array<string | ObjectId>,
			innerScope?: string | ObjectId | undefined,
			innerScopedRoles?: string[] | undefined,
		): [subscribe: (onStoreChange: () => void) => () => void, getSnapshot: () => boolean] => {
			if (innerPermissions.includes(permission)) {
				return [() => () => undefined, () => true];
			}

			return innerFn2(innerPermissions, innerScope, innerScopedRoles);
		};

		this.authorization.queryAtLeastOnePermission = outerFn2;

		const innerFn3 = this.authorization.queryAllPermissions;

		const outerFn3 = (
			innerPermissions: Array<string | ObjectId>,
			innerScope?: string | ObjectId | undefined,
			innerScopedRoles?: string[] | undefined,
		): [subscribe: (onStoreChange: () => void) => () => void, getSnapshot: () => boolean] => {
			if (innerPermissions.includes(permission)) {
				return [() => () => undefined, () => true];
			}

			return innerFn3(innerPermissions, innerScope, innerScopedRoles);
		};

		this.authorization.queryAllPermissions = outerFn3;

		return this;
	}

	withJohnDoe(): this {
		this.user.userId = 'john.doe';

		this.user.user = {
			_id: 'john.doe',
			username: 'john.doe',
			name: 'John Doe',
			createdAt: new Date(),
			active: true,
			_updatedAt: new Date(),
			roles: ['admin'],
			type: 'user',
		};

		return this;
	}

	withAnonymous(): this {
		this.user.userId = null;
		this.user.user = null;

		return this;
	}

	withRole(role: string): this {
		if (!this.user.user) {
			throw new Error('user is not defined');
		}

		this.user.user.roles.push(role);

		const innerFn = this.authorization.queryRole;

		const outerFn = (
			innerRole: string | ObjectId,
			innerScope?: string | undefined,
			innerIgnoreSubscriptions?: boolean | undefined,
		): [subscribe: (onStoreChange: () => void) => () => void, getSnapshot: () => boolean] => {
			if (innerRole === role) {
				return [() => () => undefined, () => true];
			}

			return innerFn(innerRole, innerScope, innerIgnoreSubscriptions);
		};

		this.authorization.queryRole = outerFn;

		return this;
	}

	build(): WrapperComponent<{ children: ReactNode }> {
		const queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		});

		const { connectionStatus, server, router, settings, translation, user, modal, authorization, wrappers } = this;

		return function MockedAppRoot({ children }) {
			return (
				<QueryClientProvider client={queryClient}>
					<ConnectionStatusContext.Provider value={connectionStatus}>
						<ServerContext.Provider value={server}>
							<RouterContext.Provider value={router}>
								<SettingsContext.Provider value={settings}>
									<TranslationContext.Provider value={translation}>
										{/* <SessionProvider>
                    <TooltipProvider>
                        <ToastMessagesProvider>
                            <LayoutProvider>
                                <AvatarUrlProvider>
                                    <CustomSoundProvider> */}
										<UserContext.Provider value={user}>
											{/* <DeviceProvider>*/}
											<ModalContext.Provider value={modal}>
												<AuthorizationContext.Provider value={authorization}>
													{/* <EmojiPickerProvider>
                                    <OmnichannelRoomIconProvider>
                                        <UserPresenceProvider>*/}
													<ActionManagerContext.Provider
														value={{
															triggerAction: () => Promise.reject(new Error('not implemented')),
															generateTriggerId: () => '',
															getUserInteractionPayloadByViewId: () => undefined,
															handlePayloadUserInteraction: () => undefined,
															off: () => undefined,
															on: () => undefined,
															triggerActionButtonAction: () => Promise.reject(new Error('not implemented')),
															triggerBlockAction: () => Promise.reject(new Error('not implemented')),
															triggerCancel: () => Promise.reject(new Error('not implemented')),
															triggerSubmitView: () => Promise.reject(new Error('not implemented')),
														}}
													>
														{/* <VideoConfProvider>
                        <CallProvider>
                            <OmnichannelProvider> */}
														{wrappers.reduce((children, wrapper) => wrapper(children), children)}
														{/* 		</OmnichannelProvider>
                        </CallProvider>
                    </VideoConfProvider>*/}
													</ActionManagerContext.Provider>
													{/* </UserPresenceProvider>
                                        </OmnichannelRoomIconProvider>
                    </EmojiPickerProvider>*/}
												</AuthorizationContext.Provider>
											</ModalContext.Provider>
											{/* </DeviceProvider>*/}
										</UserContext.Provider>
										{/* 			</CustomSoundProvider>
                                </AvatarUrlProvider>
                            </LayoutProvider>
                        </ToastMessagesProvider>
                    </TooltipProvider>
                </SessionProvider> */}
									</TranslationContext.Provider>
								</SettingsContext.Provider>
							</RouterContext.Provider>
						</ServerContext.Provider>
					</ConnectionStatusContext.Provider>
				</QueryClientProvider>
			);
		};
	}
}
export const mockAppRoot = () => new MockedAppRootBuilder();
