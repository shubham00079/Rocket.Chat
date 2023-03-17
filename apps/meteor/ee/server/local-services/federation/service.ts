import type { FederationPaginatedResult, IFederationPublicRooms } from '@rocket.chat/rest-typings';
import type { IFederationServiceEE } from '@rocket.chat/core-services';

import { AbstractFederationService } from '../../../../server/services/federation/service';
import type { FederationUserServiceEE } from './application/UserService';
import { FederationSearchPublicRoomsInputDto } from './application/room/sender/input/RoomInputDto';
import type { RocketChatRoomAdapterEE } from './infrastructure/rocket-chat/adapters/Room';
import type { RocketChatUserAdapterEE } from './infrastructure/rocket-chat/adapters/User';
import { FederationFactoryEE } from './infrastructure/Factory';
import type { IFederationBridgeEE } from './domain/IFederationBridge';
import { FederationRoomSenderConverterEE } from './infrastructure/rocket-chat/converters/RoomSender';
import type { FederationDirectMessageRoomServiceSender } from './application/room/sender/DirectMessageRoomServiceSender';
import type { FederationRoomServiceSender } from './application/room/sender/RoomServiceSender';

abstract class AbstractBaseFederationServiceEE extends AbstractFederationService {
	protected internalUserServiceEE: FederationUserServiceEE;

	protected directMessageRoomServiceSenderEE: FederationDirectMessageRoomServiceSender;

	protected internalRoomServiceSenderEE: FederationRoomServiceSender;

	protected internalRoomAdapterEE: RocketChatRoomAdapterEE;

	protected internalUserAdapterEE: RocketChatUserAdapterEE;

	constructor() {
		const internalQueueInstance = FederationFactoryEE.buildFederationQueue();
		const internalSettingsAdapter = FederationFactoryEE.buildInternalSettingsAdapter();
		const bridgeEE = FederationFactoryEE.buildFederationBridge(internalSettingsAdapter, internalQueueInstance);
		super(bridgeEE, internalQueueInstance, internalSettingsAdapter);

		this.internalRoomAdapterEE = FederationFactoryEE.buildInternalRoomAdapter();
		this.internalUserAdapterEE = FederationFactoryEE.buildInternalUserAdapter();
		this.internalUserServiceEE = FederationFactoryEE.buildRoomApplicationService(
			this.getInternalSettingsAdapter(),
			this.internalUserAdapterEE,
			this.getInternalFileAdapter(),
			this.getBridge(),
		);
		this.directMessageRoomServiceSenderEE = FederationFactoryEE.buildDirectMessageRoomServiceSender(
			this.internalRoomAdapterEE,
			this.internalUserAdapterEE,
			this.getInternalFileAdapter(),
			this.getInternalSettingsAdapter(),
			this.getBridge(),
		);
		this.internalRoomServiceSenderEE = FederationFactoryEE.buildRoomServiceSenderEE(
			this.internalRoomAdapterEE,
			this.internalUserAdapterEE,
			this.getInternalFileAdapter(),
			this.getInternalSettingsAdapter(),
			this.getInternalMessageAdapter(),
			this.getInternalNotificationAdapter(),
			this.getBridge(),
		);
	}

	protected async setupInternalEphemeralListeners(): Promise<void> {
		await this.getInternalNotificationAdapter().subscribeToUserTypingEventsOnFederatedRooms(
			this.getInternalNotificationAdapter().broadcastUserTypingOnRoom.bind(this.getInternalNotificationAdapter()),
		);
	}

	protected async setupInternalValidators(): Promise<void> {
		const internalRoomHooksValidator = FederationFactoryEE.buildRoomInternalValidator(
			this.internalRoomAdapterEE,
			this.internalUserAdapterEE,
			this.getInternalFileAdapter(),
			this.getInternalSettingsAdapter(),
			this.getBridge(),
		);
		FederationFactoryEE.setupValidators(internalRoomHooksValidator);
	}

	protected async setupInternalActionListeners(): Promise<void> {
		const internalRoomServiceSender = FederationFactoryEE.buildRoomServiceSender(
			this.internalRoomAdapterEE,
			this.internalUserAdapterEE,
			this.getInternalFileAdapter(),
			this.getInternalMessageAdapter(),
			this.getInternalSettingsAdapter(),
			this.getInternalNotificationAdapter(),
			this.getBridge(),
		);
		const internalMessageServiceSender = FederationFactoryEE.buildMessageServiceSender(
			this.internalRoomAdapterEE,
			this.internalUserAdapterEE,
			this.getInternalSettingsAdapter(),
			this.getInternalMessageAdapter(),
			this.getBridge(),
		);
		FederationFactoryEE.setupListenersForLocalActions(internalRoomServiceSender, internalMessageServiceSender);
		FederationFactoryEE.setupListenersForLocalActionsEE(
			this.internalRoomServiceSenderEE,
			this.directMessageRoomServiceSenderEE,
			this.getInternalSettingsAdapter(),
		);
	}

	protected async onEnableFederation(): Promise<void> {
		await super.setupFederation();
		await this.startFederation();
	}

	protected async onDisableFederation(): Promise<void> {
		await this.stopFederation();
	}

	private getBridge(): IFederationBridgeEE {
		return this.bridge as IFederationBridgeEE;
	}

	private async startFederation(): Promise<void> {
		if (!this.isFederationEnabled()) {
			return;
		}
		await this.bridge.start();
		this.bridge.logFederationStartupInfo('Running Federation Enterprise V2');
		FederationFactoryEE.removeCEValidators();
		await import('./infrastructure/rocket-chat/slash-commands');
		await import('../../api/federation');
	}

	private async stopFederation(): Promise<void> {
		await this.bridge.stop();
		FederationFactoryEE.removeAllListeners();
		await super.cleanUpHandlers();
	}

	public async created(): Promise<void> {
		await super.setupFederation();
		await this.startFederation();
	}

	public async stopped(): Promise<void> {
		await this.stopFederation();
		await super.stopped();
	}
}

export class FederationServiceEE extends AbstractBaseFederationServiceEE implements IFederationServiceEE {
	protected name = 'federation-enterprise';

	public async createDirectMessageRoom(internalUserId: string, invitees: string[]): Promise<void> {
		await this.directMessageRoomServiceSenderEE.createInternalLocalDirectMessageRoom(
			FederationRoomSenderConverterEE.toCreateDirectMessageDto(internalUserId, invitees),
		);
	}

	public async searchPublicRooms(
		serverName?: string,
		roomName?: string,
		pageToken?: string,
		count?: number,
	): Promise<
		FederationPaginatedResult<{
			rooms: IFederationPublicRooms[];
		}>
	> {
		return this.internalRoomServiceSenderEE.searchPublicRooms(
			new FederationSearchPublicRoomsInputDto({
				serverName,
				roomName,
				pageToken,
				count,
			}),
		);
	}

	public async getSearchedServerNamesByInternalUserId(
		internalUserId: string,
	): Promise<{ name: string; default: boolean; local: boolean }[]> {
		return this.internalUserServiceEE.getSearchedServerNamesByInternalUserId(internalUserId);
	}

	public async addSearchedServerNameByInternalUserId(internalUserId: string, serverName: string): Promise<void> {
		return this.internalUserServiceEE.addSearchedServerNameByInternalUserId(internalUserId, serverName);
	}

	public async removeSearchedServerNameByInternalUserId(internalUserId: string, serverName: string): Promise<void> {
		return this.internalUserServiceEE.removeSearchedServerNameByInternalUserId(internalUserId, serverName);
	}

	public async joinExternalPublicRoom(internalUserId: string, externalRoomId: string): Promise<void> {
		await this.internalRoomServiceSenderEE.joinExternalPublicRoom(
			FederationRoomSenderConverterEE.toJoinExternalPublicRoomDto(internalUserId, externalRoomId),
		);
	}
}
