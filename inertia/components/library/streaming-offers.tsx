import { Badge } from '@/components/ui/badge'

export interface StreamingOffer {
  monetizationType: string
  providerId: number
  providerName: string
  providerIconUrl: string
  presentationType: string
  url: string
  retailPrice?: number
  currency?: string
}

/**
 * Where a title can be streamed, rented or bought. Browsing, not operating — so it lives
 * on the full detail page rather than in the add-or-not sheet.
 */
export function StreamingOffers({ offers }: { offers?: StreamingOffer[] }) {
  if (!offers || offers.length === 0) return null

  const flatrateOffers = offers.filter((o) => o.monetizationType === 'flatrate')
  const rentBuyOffers = offers.filter(
    (o) => o.monetizationType === 'rent' || o.monetizationType === 'buy'
  )

  return (
    <div>
      <h4 className="text-base font-semibold mb-3">Where to Watch</h4>
      {flatrateOffers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {flatrateOffers.map((offer) => (
            <a
              key={`${offer.providerId}-${offer.presentationType}`}
              href={offer.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 hover:bg-accent transition-colors focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {offer.providerIconUrl && (
                <img
                  src={offer.providerIconUrl}
                  alt={offer.providerName}
                  className="w-6 h-6 rounded-sm ring-1 ring-border"
                />
              )}
              <span className="text-sm font-medium">{offer.providerName}</span>
              {offer.presentationType && (
                <Badge variant="outline" className="px-1.5 py-0">
                  {offer.presentationType.toUpperCase()}
                </Badge>
              )}
            </a>
          ))}
        </div>
      )}
      {rentBuyOffers.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-2">Also available to rent or buy:</p>
          <div className="flex flex-wrap gap-2">
            {rentBuyOffers.map((offer) => (
              <a
                key={`${offer.providerId}-${offer.monetizationType}-${offer.presentationType}`}
                href={offer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 hover:bg-accent transition-colors text-xs focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {offer.providerIconUrl && (
                  <img
                    src={offer.providerIconUrl}
                    alt={offer.providerName}
                    className="w-4 h-4 rounded-sm ring-1 ring-border"
                  />
                )}
                <span>{offer.providerName}</span>
                <span className="text-muted-foreground">
                  {offer.monetizationType === 'rent' ? 'Rent' : 'Buy'}
                  {offer.retailPrice ? (
                    <span className="readout">
                      {' '}
                      {offer.currency || 'EUR'} {offer.retailPrice.toFixed(2)}
                    </span>
                  ) : (
                    ''
                  )}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
